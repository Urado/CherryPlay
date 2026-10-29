using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests.IntegrationDb;

[TestFixture]
[NonParallelizable]
[Category("IntegrationDb")]
public sealed class AdminPartyPersistenceSpecificationIntegrationTests
{
    private PostgresContainerFixture _postgresFixture = null!;

    [OneTimeSetUp]
    public async Task OneTimeSetUp()
    {
        _postgresFixture = new PostgresContainerFixture();
        await _postgresFixture.InitializeAsync();
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown()
    {
        await _postgresFixture.DisposeAsync();
    }

    [Test]
    public async Task ListParties_IncludesHiddenLifecycleAndSoftDeletedRecords()
    {
        var scenario = await CreateScenarioAsync();
        try
        {
            using var response = await scenario.Client.GetAsync("/api/admin/parties?page=1&pageSize=20");
            var body = await response.Content.ReadAsStringAsync();

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
            using var document = JsonDocument.Parse(body);
            var items = document.RootElement.GetProperty("items").EnumerateArray().ToArray();
            Assert.That(items.Select(item => item.GetProperty("id").GetString()), Does.Contain(scenario.VisibleDraftPartyId.ToString()));
            Assert.That(items.Select(item => item.GetProperty("id").GetString()), Does.Contain(scenario.HiddenCompletedPartyId.ToString()));
            Assert.That(items.Select(item => item.GetProperty("id").GetString()), Does.Contain(scenario.DeletedPartyId.ToString()));
            Assert.That(items.Select(item => item.GetProperty("id").GetString()), Does.Contain(scenario.DeletedOrganizerPartyId.ToString()));
            Assert.That(items.Single(item => item.GetProperty("id").GetString() == scenario.HiddenCompletedPartyId.ToString())
                .GetProperty("isListedInCatalog").GetBoolean(), Is.False);
            Assert.That(items.Single(item => item.GetProperty("id").GetString() == scenario.DeletedPartyId.ToString())
                .GetProperty("isDeleted").GetBoolean(), Is.True);
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    [Test]
    public async Task ListParties_CombinesOrganizerNameCityAndLifecycleFiltersBeforePaging()
    {
        var scenario = await CreateScenarioAsync();
        try
        {
            using var response = await scenario.Client.GetAsync(
                $"/api/admin/parties?organizerId={scenario.OrganizerId}&query=Specification%20Night&city=Moscow&partyLifecycleState=draft&page=1&pageSize=20");
            var body = await response.Content.ReadAsStringAsync();

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
            using var document = JsonDocument.Parse(body);
            var items = document.RootElement.GetProperty("items").EnumerateArray().ToArray();
            Assert.That(items, Has.Length.EqualTo(1));
            Assert.That(items[0].GetProperty("id").GetString(), Is.EqualTo(scenario.VisibleDraftPartyId.ToString()));
            Assert.That(document.RootElement.GetProperty("total").GetInt32(), Is.EqualTo(1));
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    [TestCase("organizerId")]
    [TestCase("query")]
    [TestCase("city")]
    [TestCase("partyLifecycleState")]
    public async Task ListParties_AppliesEachFilterIndependently(string filter)
    {
        var scenario = await CreateScenarioAsync();
        try
        {
            var (query, expectedIds) = filter switch
            {
                "organizerId" => ($"organizerId={scenario.OrganizerId}", new[] { scenario.VisibleDraftPartyId, scenario.HiddenCompletedPartyId, scenario.DeletedPartyId }),
                "query" => ("query=Specification%20Night", new[] { scenario.VisibleDraftPartyId, scenario.HiddenCompletedPartyId }),
                "city" => ("city=Moscow", new[] { scenario.VisibleDraftPartyId, scenario.HiddenCompletedPartyId, scenario.DeletedPartyId }),
                _ => ("partyLifecycleState=draft", new[] { scenario.VisibleDraftPartyId })
            };
            using var response = await scenario.Client.GetAsync($"/api/admin/parties?{query}&page=1&pageSize=20");
            var body = await response.Content.ReadAsStringAsync();

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
            using var document = JsonDocument.Parse(body);
            var actualIds = document.RootElement.GetProperty("items").EnumerateArray()
                .Select(item => Guid.Parse(item.GetProperty("id").GetString()!))
                .ToArray();
            Assert.That(actualIds, Is.EquivalentTo(expectedIds));
            Assert.That(document.RootElement.GetProperty("total").GetInt32(), Is.EqualTo(expectedIds.Length));
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    [TestCase("isListedInCatalog", false, 1)]
    [TestCase("isListedInCatalog", true, 3)]
    [TestCase("isDeleted", false, 3)]
    [TestCase("isDeleted", true, 1)]
    public async Task ListParties_AppliesVisibilityAndDeletedFiltersBeforePaging(string filter, bool value, int expectedTotal)
    {
        var scenario = await CreateScenarioAsync();
        try
        {
            using var response = await scenario.Client.GetAsync($"/api/admin/parties?{filter}={value.ToString().ToLowerInvariant()}&page=1&pageSize=20");
            var body = await response.Content.ReadAsStringAsync();

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
            using var document = JsonDocument.Parse(body);
            var items = document.RootElement.GetProperty("items").EnumerateArray().ToArray();
            Assert.That(document.RootElement.GetProperty("total").GetInt32(), Is.EqualTo(expectedTotal));
            Assert.That(items.All(item => item.GetProperty(filter == "isDeleted" ? "isDeleted" : "isListedInCatalog").GetBoolean() == value), Is.True);
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    [Test]
    public async Task GetPartyDetail_IncludesDeletedPartyAndOrganizerWithSessionAndPlaylist()
    {
        var scenario = await CreateScenarioAsync(activeSession: true);
        try
        {
            await using (var db = CreateDbContext(scenario.ConnectionString))
            {
                db.PartyPlaylists.Add(new PartyPlaylistEf
                {
                    PartyId = scenario.DeletedPartyId,
                    Items = [new CherryPlayServer.Core.Entities.PlayerItem { Id = "stored-track", Name = "Stored track" }],
                    TotalTracks = 1,
                    TotalDuration = 210
                });
                await db.SaveChangesAsync();
            }

            using var response = await scenario.Client.GetAsync($"/api/admin/parties/{scenario.DeletedPartyId}");
            var body = await response.Content.ReadAsStringAsync();

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            Assert.That(root.GetProperty("isDeleted").GetBoolean(), Is.True);
            Assert.That(root.GetProperty("organizerName").GetString(), Is.EqualTo("Specification organizer"));
            Assert.That(root.GetProperty("hasActiveSession").GetBoolean(), Is.False);
            Assert.That(root.GetProperty("playlist").GetProperty("items")[0].GetProperty("id").GetString(), Is.EqualTo("stored-track"));

            using var activeResponse = await scenario.Client.GetAsync($"/api/admin/parties/{scenario.VisibleDraftPartyId}");
            var activeBody = await activeResponse.Content.ReadAsStringAsync();
            Assert.That(activeResponse.StatusCode, Is.EqualTo(HttpStatusCode.OK), activeBody);
            using var activeDocument = JsonDocument.Parse(activeBody);
            Assert.That(activeDocument.RootElement.GetProperty("hasActiveSession").GetBoolean(), Is.True);
            Assert.That(activeDocument.RootElement.GetProperty("playbackState").GetProperty("isActive").GetBoolean(), Is.True);
            Assert.That(activeDocument.RootElement.GetProperty("isOrganizerConnected").GetBoolean(), Is.False);
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    [Test]
    public async Task ResetSession_ClearsPersistedPlaybackWithoutChangingPlaylistOrParty()
    {
        var scenario = await CreateScenarioAsync(initialState: PartyLifecycleState.Completed, activeSession: true);
        try
        {
            await using (var db = CreateDbContext(scenario.ConnectionString))
            {
                var session = await db.SessionStates.SingleAsync(item => item.PartyId == scenario.VisibleDraftPartyId);
                session.SessionStartedAt = DateTime.UtcNow.AddHours(-1);
                session.CurrentTrackId = "playing-track";
                session.Status = "playing";
                session.Position = 42;
                session.Duration = 180;
                session.Mode = "session";
                session.PlayedTrackIds = ["playing-track"];
                session.DisabledTrackIds = ["disabled-track"];
                session.DisabledGroupIds = ["disabled-group"];
                db.PartyPlaylists.Add(new PartyPlaylistEf
                {
                    PartyId = scenario.VisibleDraftPartyId,
                    Items = [new CherryPlayServer.Core.Entities.PlayerItem { Id = "playlist-track", Name = "Keep this" }],
                    TotalTracks = 1,
                    TotalDuration = 180
                });
                await db.SaveChangesAsync();
            }

            using var response = await scenario.Client.PostAsync($"/api/admin/parties/{scenario.VisibleDraftPartyId}/session-resets", null);
            var body = await response.Content.ReadAsStringAsync();
            await using var verifyDb = CreateDbContext(scenario.ConnectionString);
            var party = await verifyDb.Parties.SingleAsync(item => item.Id == scenario.VisibleDraftPartyId);
            var sessionState = await verifyDb.SessionStates.SingleAsync(item => item.PartyId == scenario.VisibleDraftPartyId);
            var playlist = await verifyDb.PartyPlaylists.SingleAsync(item => item.PartyId == scenario.VisibleDraftPartyId);

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
            Assert.That(party.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Completed));
            Assert.That(party.IsListedInCatalog, Is.True);
            Assert.That(sessionState.IsActive, Is.False);
            Assert.That(sessionState.SessionStartedAt, Is.Null);
            Assert.That(sessionState.CurrentTrackId, Is.Null);
            Assert.That(sessionState.Status, Is.EqualTo("idle"));
            Assert.That(sessionState.Mode, Is.EqualTo("preparation"));
            Assert.That(sessionState.Position, Is.Zero);
            Assert.That(sessionState.Duration, Is.Zero);
            Assert.That(sessionState.PlayedTrackIds, Is.Empty);
            Assert.That(sessionState.DisabledTrackIds, Is.Empty);
            Assert.That(sessionState.DisabledGroupIds, Is.Empty);
            Assert.That(playlist.Items.Single().Id, Is.EqualTo("playlist-track"));
            using var result = JsonDocument.Parse(body);
            Assert.That(result.RootElement.GetProperty("wasReset").GetBoolean(), Is.True);
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    [Test]
    public async Task ResetSession_DeletedPartyIsReadOnly()
    {
        var scenario = await CreateScenarioAsync();
        try
        {
            using var response = await scenario.Client.PostAsync($"/api/admin/parties/{scenario.DeletedPartyId}/session-resets", null);

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.That(document.RootElement.GetProperty("code").GetString(), Is.EqualTo("party_not_found"));
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    [Test]
    public async Task ResetSession_ActiveConnectedDesktopIsRejectedWithoutPersistedChanges()
    {
        var scenario = await CreateScenarioAsync(activeSession: true, desktopConnected: true);
        try
        {
            using var response = await scenario.Client.PostAsync($"/api/admin/parties/{scenario.VisibleDraftPartyId}/session-resets", null);
            var body = await response.Content.ReadAsStringAsync();
            await using var db = CreateDbContext(scenario.ConnectionString);
            var state = await db.SessionStates.SingleAsync(item => item.PartyId == scenario.VisibleDraftPartyId);

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Conflict), body);
            using var document = JsonDocument.Parse(body);
            Assert.That(document.RootElement.GetProperty("code").GetString(), Is.EqualTo("active_connected_session"));
            Assert.That(state.IsActive, Is.True);
            Assert.That(state.Mode, Is.EqualTo("session"));
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    [Test]
    public async Task ListParties_StablePaginationAcrossIdenticalCreatedAt_HasNoDuplicatesOrGaps()
    {
        var scenario = await CreateScenarioAsync(extraPartyCount: 41, sameCreatedAt: true);
        try
        {
            var allIds = new List<string>();
            for (var page = 1; page <= 3; page++)
            {
                using var response = await scenario.Client.GetAsync($"/api/admin/parties?organizerId={scenario.OrganizerId}&page={page}&pageSize=20");
                var body = await response.Content.ReadAsStringAsync();
                Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
                using var document = JsonDocument.Parse(body);
                allIds.AddRange(document.RootElement.GetProperty("items").EnumerateArray()
                    .Select(item => item.GetProperty("id").GetString()!));
                Assert.That(document.RootElement.GetProperty("total").GetInt32(), Is.EqualTo(44));
            }

            Assert.That(allIds, Has.Count.EqualTo(44));
            Assert.That(allIds.Distinct().ToArray(), Has.Length.EqualTo(44));
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    [TestCase(PartyLifecycleState.Draft, PartyLifecycleState.Draft)]
    [TestCase(PartyLifecycleState.Draft, PartyLifecycleState.Ready)]
    [TestCase(PartyLifecycleState.Draft, PartyLifecycleState.Completed)]
    [TestCase(PartyLifecycleState.Ready, PartyLifecycleState.Draft)]
    [TestCase(PartyLifecycleState.Ready, PartyLifecycleState.Ready)]
    [TestCase(PartyLifecycleState.Ready, PartyLifecycleState.Completed)]
    [TestCase(PartyLifecycleState.Completed, PartyLifecycleState.Draft)]
    [TestCase(PartyLifecycleState.Completed, PartyLifecycleState.Ready)]
    [TestCase(PartyLifecycleState.Completed, PartyLifecycleState.Completed)]
    public async Task SetLifecycle_AllSourceAndTargetStatesPersist(
        PartyLifecycleState sourceState,
        PartyLifecycleState targetState)
    {
        var scenario = await CreateScenarioAsync(initialState: sourceState);
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{scenario.VisibleDraftPartyId}/lifecycle")
            {
                Content = JsonContent(new { partyLifecycleState = targetState.ToString().ToLowerInvariant() })
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", scenario.Token);

            using var response = await scenario.Client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            await using var db = CreateDbContext(scenario.ConnectionString);
            var saved = await db.Parties.IgnoreQueryFilters().SingleAsync(item => item.Id == scenario.VisibleDraftPartyId);

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
            Assert.That(saved.PartyLifecycleState, Is.EqualTo(targetState));
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    [Test]
    public async Task SetLifecycle_SoftDeletedParty_IsRejectedWithoutChangingStoredRecord()
    {
        var scenario = await CreateScenarioAsync();
        try
        {
            using (var listResponse = await scenario.Client.GetAsync("/api/admin/parties?page=1&pageSize=20"))
            {
                var listBody = await listResponse.Content.ReadAsStringAsync();
                Assert.That(listResponse.StatusCode, Is.EqualTo(HttpStatusCode.OK), listBody);
                using var list = JsonDocument.Parse(listBody);
                Assert.That(list.RootElement.GetProperty("items").EnumerateArray()
                    .Any(item => item.GetProperty("id").GetString() == scenario.DeletedPartyId.ToString()), Is.True);
            }
            using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{scenario.DeletedPartyId}/lifecycle")
            {
                Content = JsonContent(new { partyLifecycleState = "ready" })
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", scenario.Token);

            using var response = await scenario.Client.SendAsync(request);
            await using var db = CreateDbContext(scenario.ConnectionString);
            var saved = await db.Parties.IgnoreQueryFilters().SingleAsync(item => item.Id == scenario.DeletedPartyId);

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            Assert.That(saved.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Completed));
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    [Test]
    public async Task SetCatalogVisibility_SoftDeletedParty_IsRejectedWithoutChangingStoredRecord()
    {
        var scenario = await CreateScenarioAsync();
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{scenario.DeletedPartyId}/catalog-visibility")
            {
                Content = JsonContent(new { isListedInCatalog = false })
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", scenario.Token);

            using var response = await scenario.Client.SendAsync(request);
            await using var db = CreateDbContext(scenario.ConnectionString);
            var saved = await db.Parties.IgnoreQueryFilters().SingleAsync(item => item.Id == scenario.DeletedPartyId);

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
            Assert.That(saved.IsListedInCatalog, Is.True);
            Assert.That(saved.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Completed));
            Assert.That(saved.IsDeleted, Is.True);
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    [Test]
    public async Task SetCatalogVisibility_DuringActiveSessionAndConnectedDesktop_PersistsWithoutEndingSession()
    {
        var scenario = await CreateScenarioAsync(activeSession: true, desktopConnected: true);
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{scenario.VisibleDraftPartyId}/catalog-visibility")
            {
                Content = JsonContent(new { isListedInCatalog = false })
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", scenario.Token);

            using var response = await scenario.Client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            await using var db = CreateDbContext(scenario.ConnectionString);
            var savedParty = await db.Parties.SingleAsync(item => item.Id == scenario.VisibleDraftPartyId);
            var savedSession = await db.SessionStates.SingleAsync(item => item.PartyId == scenario.VisibleDraftPartyId);

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
            Assert.That(savedParty.IsListedInCatalog, Is.False);
            Assert.That(savedSession.IsActive, Is.True);
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    [Test]
    public async Task UserMetadataUpdate_FromStalePartySnapshot_PreservesConcurrentLifecycleChange()
    {
        var scenario = await CreateScenarioAsync(initialState: PartyLifecycleState.Ready);
        try
        {
            CherryPlayServer.Core.Entities.Party staleParty;
            await using (var staleDb = CreateDbContext(scenario.ConnectionString))
            {
                staleParty = (await new EfPartyRepository(staleDb, NullLogger<EfPartyRepository>.Instance)
                    .GetByIdAsync(scenario.VisibleDraftPartyId))!;
            }
            await using (var adminDb = CreateDbContext(scenario.ConnectionString))
            {
                var storedParty = await adminDb.Parties.SingleAsync(item => item.Id == scenario.VisibleDraftPartyId);
                storedParty.PartyLifecycleState = PartyLifecycleState.Completed;
                await adminDb.SaveChangesAsync();
            }
            staleParty.Name = "Updated by organizer from stale snapshot";
            await using (var userDb = CreateDbContext(scenario.ConnectionString))
            {
                await new EfPartyRepository(userDb, NullLogger<EfPartyRepository>.Instance).UpdateAsync(staleParty);
            }
            await using var verifyDb = CreateDbContext(scenario.ConnectionString);
            var finalParty = await verifyDb.Parties.SingleAsync(item => item.Id == scenario.VisibleDraftPartyId);

            Assert.That(finalParty.Name, Is.EqualTo("Updated by organizer from stale snapshot"));
            Assert.That(finalParty.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Completed));
        }
        finally
        {
            await scenario.DisposeAsync();
        }
    }

    private async Task<AdminPartyApiScenario> CreateScenarioAsync(
        PartyLifecycleState initialState = PartyLifecycleState.Draft,
        bool activeSession = false,
        bool desktopConnected = false,
        int extraPartyCount = 0,
        bool sameCreatedAt = false)
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        var options = CreateDbContextOptions(connectionString);
        var organizerId = Guid.NewGuid();
        var deletedOrganizerId = Guid.NewGuid();
        var visibleDraftPartyId = Guid.NewGuid();
        var hiddenCompletedPartyId = Guid.NewGuid();
        var deletedPartyId = Guid.NewGuid();
        var deletedOrganizerPartyId = Guid.NewGuid();
        var adminSessionId = Guid.NewGuid();
        var createdAt = DateTime.UtcNow;
        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
            db.Organizers.AddRange(
                new OrganizerEf { Id = organizerId, Name = "Specification organizer", Role = "admin", CreatedAt = createdAt },
                new OrganizerEf { Id = deletedOrganizerId, Name = "Deleted organizer", Role = "organizer", CreatedAt = createdAt, IsDeleted = true });
            db.OrganizerSessions.Add(new OrganizerSessionEf
            {
                Id = adminSessionId,
                OrganizerId = organizerId,
                CreatedAt = createdAt
            });
            db.Parties.AddRange(
                CreateParty(visibleDraftPartyId, organizerId, "Specification Night draft", "Moscow", initialState, true, createdAt),
                CreateParty(hiddenCompletedPartyId, organizerId, "Specification Night hidden", "Moscow", PartyLifecycleState.Completed, false, createdAt),
                CreateParty(deletedPartyId, organizerId, "Deleted party", "Moscow", PartyLifecycleState.Completed, true, createdAt, isDeleted: true),
                CreateParty(deletedOrganizerPartyId, deletedOrganizerId, "Deleted owner party", "Kazan", PartyLifecycleState.Ready, true, createdAt));
            for (var index = 0; index < extraPartyCount; index++)
            {
                var id = Guid.NewGuid();
                db.Parties.Add(CreateParty(
                    id,
                    organizerId,
                    $"Pagination party {index:D2}",
                    index % 2 == 0 ? "Moscow" : "Kazan",
                    PartyLifecycleState.Ready,
                    index % 2 == 0,
                    sameCreatedAt ? createdAt : createdAt.AddMinutes(index)));
            }
            if (activeSession)
            {
                db.SessionStates.Add(new SessionStateEf
                {
                    PartyId = visibleDraftPartyId,
                    IsActive = true,
                    Mode = "session",
                    LastUpdatedAt = createdAt
                });
            }
            await db.SaveChangesAsync();
        }

        var factory = new IntegrationDbWebApplicationFactory(connectionString);
        var client = factory.CreateClient();
        string token;
        using (var scope = factory.Services.CreateScope())
        {
            var jwtService = scope.ServiceProvider.GetRequiredService<IJwtService>();
            token = await jwtService.GenerateTokenAsync(organizerId, "Specification organizer", adminSessionId, "admin");
            if (desktopConnected)
            {
                scope.ServiceProvider.GetRequiredService<IOrganizerConnectionTracker>()
                    .RegisterOrganizer($"admin-persistence-{visibleDraftPartyId:N}", visibleDraftPartyId);
            }
        }
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return new AdminPartyApiScenario(
            factory,
            client,
            connectionString,
            token,
            organizerId,
            visibleDraftPartyId,
            hiddenCompletedPartyId,
            deletedPartyId,
            deletedOrganizerPartyId);
    }

    private static PartyEf CreateParty(
        Guid id,
        Guid organizerId,
        string name,
        string city,
        PartyLifecycleState state,
        bool listed,
        DateTime createdAt,
        bool isDeleted = false) => new()
    {
        Id = id,
        OrganizerId = organizerId,
        Name = name,
        ShortCode = $"{id:N}"[..7],
        City = city,
        PartyThemeId = "basic",
        CreatedAt = createdAt,
        IsListedInCatalog = listed,
        PartyLifecycleState = state,
        IsDeleted = isDeleted
    };

    private static DbContextOptions<AppDbContext> CreateDbContextOptions(string connectionString) =>
        new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;

    private static AppDbContext CreateDbContext(string connectionString) => new(CreateDbContextOptions(connectionString));

    private static StringContent JsonContent<T>(T value) =>
        new(JsonSerializer.Serialize(value), Encoding.UTF8, "application/json");

}
