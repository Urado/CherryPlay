using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CherryPlayServer.Core;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CherryPlayServer.Tests.IntegrationDb;

/// <summary>
/// EF + Postgres IntegrationDb: register/consent/delete + legal document seed/rollout.
/// </summary>
[TestFixture]
[NonParallelizable]
[Category("IntegrationDb")]
public sealed class IntegrationDbLegalConsentTests
{
    private static readonly Guid SeedPdVersionId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid SeedTermsVersionId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid SeedRetiredPdVersionId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private const string SeedPdHashV1 =
        "4fb5ee6b4636828a5f72c3b1091721e02c53c93160db5449e80348f24e0f84bc";
    private const string SeedTermsHashV1 =
        "63446e6df641cb350ba24e197390c03f76ded704bfe12e692eeeb62c84e14b44";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

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
    public async Task Migrate_FromZero_SeedsLegalDocumentRegistry()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        _ = factory.CreateClient();
        await factory.WaitUntilDatabaseReachableAsync();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var versions = await db.LegalDocumentVersions.AsNoTracking().ToListAsync();

        Assert.That(versions, Has.Count.EqualTo(3));
        Assert.That(
            versions.Single(v => v.Id == SeedPdVersionId).ContentHash,
            Is.EqualTo(SeedPdHashV1));
        Assert.That(
            versions.Single(v => v.Id == SeedTermsVersionId).ContentHash,
            Is.EqualTo(SeedTermsHashV1));
        Assert.That(
            versions.Single(v => v.Id == SeedRetiredPdVersionId).Status,
            Is.EqualTo("retired"));
        Assert.That(versions.Count(v => v.Status == "active"), Is.EqualTo(2));
    }

    [Test]
    public async Task Register_WithConsents_Login_AndProfile_Succeeds()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        using var client = factory.CreateClient();

        var email = $"reg-{Guid.NewGuid():N}@example.com";
        var password = "password1";
        var organizerId = await RegisterAsync(client, email, password, "Reg Organizer");

        var token = await LoginAsync(client, email, password);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var meResponse = await client.GetAsync("/api/organizer/me");
        var meBody = await meResponse.Content.ReadAsStringAsync();
        Assert.That(meResponse.StatusCode, Is.EqualTo(HttpStatusCode.OK), meBody);
        using var meDoc = JsonDocument.Parse(meBody);
        Assert.That(meDoc.RootElement.GetProperty("id").GetGuid(), Is.EqualTo(organizerId));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.That(await db.EmailAccounts.AnyAsync(e => e.OrganizerId == organizerId), Is.True);
        var grants = await db.ConsentEvents
            .Where(e => e.SubjectId == organizerId && e.Decision == "grant")
            .ToListAsync();
        Assert.That(grants, Has.Count.EqualTo(2));
    }

    [Test]
    public async Task Register_WithBadConsents_Returns400_AndLeavesNoOrganizer()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        using var client = factory.CreateClient();

        var email = $"bad-{Guid.NewGuid():N}@example.com";
        using var response = await client.PostAsync(
            "/api/organizers",
            JsonContent(new
            {
                email,
                password = "password1",
                name = "Bad Consents",
                consents = new object[]
                {
                    new
                    {
                        id = Guid.NewGuid(),
                        legalDocumentVersionId = SeedPdVersionId,
                        documentHash = "not-a-real-hash",
                        decision = "grant"
                    },
                    new
                    {
                        id = Guid.NewGuid(),
                        legalDocumentVersionId = SeedTermsVersionId,
                        documentHash = SeedTermsHashV1,
                        decision = "grant"
                    }
                }
            }));
        var body = await response.Content.ReadAsStringAsync();
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), body);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.That(await db.EmailAccounts.AnyAsync(e => e.Email == email), Is.False);
        Assert.That(await db.Organizers.IgnoreQueryFilters().AnyAsync(o => o.Name == "Bad Consents"), Is.False);
    }

    [Test]
    public async Task Register_IdempotentReplay_ReturnsSameOrganizer()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        using var client = factory.CreateClient();

        var email = $"idem-{Guid.NewGuid():N}@example.com";
        var grantPdId = Guid.NewGuid();
        var grantTermsId = Guid.NewGuid();
        var payload = BuildRegisterPayload(email, "password1", "Idem Organizer", grantPdId, grantTermsId);

        using var first = await client.PostAsync("/api/organizers", JsonContent(payload));
        var firstBody = await first.Content.ReadAsStringAsync();
        Assert.That(first.StatusCode, Is.EqualTo(HttpStatusCode.Created), firstBody);
        var firstId = JsonDocument.Parse(firstBody).RootElement.GetProperty("id").GetGuid();

        using var second = await client.PostAsync("/api/organizers", JsonContent(payload));
        var secondBody = await second.Content.ReadAsStringAsync();
        Assert.That(second.StatusCode, Is.EqualTo(HttpStatusCode.Created), secondBody);
        var secondId = JsonDocument.Parse(secondBody).RootElement.GetProperty("id").GetGuid();

        Assert.That(secondId, Is.EqualTo(firstId));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.That(await db.Organizers.CountAsync(o => o.Id == firstId), Is.EqualTo(1));
        Assert.That(await db.ConsentEvents.CountAsync(e => e.SubjectId == firstId), Is.EqualTo(2));
    }

    [Test]
    public async Task ConsentEvents_AppendAndList_Works()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        using var client = factory.CreateClient();

        var email = $"events-{Guid.NewGuid():N}@example.com";
        var organizerId = await RegisterAsync(client, email, "password1", "Events Organizer");
        var token = await LoginAsync(client, email, "password1");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var listBefore = await client.GetAsync("/api/consent-events");
        var beforeBody = await listBefore.Content.ReadAsStringAsync();
        Assert.That(listBefore.StatusCode, Is.EqualTo(HttpStatusCode.OK), beforeBody);
        Assert.That(JsonDocument.Parse(beforeBody).RootElement.GetArrayLength(), Is.EqualTo(2));

        var extraPdId = Guid.NewGuid();
        var extraTermsId = Guid.NewGuid();
        using var create = await client.PostAsync(
            "/api/consent-events",
            JsonContent(new
            {
                events = new object[]
                {
                    new
                    {
                        id = extraPdId,
                        legalDocumentVersionId = SeedPdVersionId,
                        documentHash = SeedPdHashV1,
                        decision = "grant"
                    },
                    new
                    {
                        id = extraTermsId,
                        legalDocumentVersionId = SeedTermsVersionId,
                        documentHash = SeedTermsHashV1,
                        decision = "grant"
                    }
                }
            }));
        var createBody = await create.Content.ReadAsStringAsync();
        Assert.That(create.StatusCode, Is.EqualTo(HttpStatusCode.Created), createBody);

        using var listAfter = await client.GetAsync("/api/consent-events");
        var afterBody = await listAfter.Content.ReadAsStringAsync();
        Assert.That(listAfter.StatusCode, Is.EqualTo(HttpStatusCode.OK), afterBody);
        var ids = JsonDocument.Parse(afterBody).RootElement.EnumerateArray()
            .Select(e => e.GetProperty("id").GetGuid())
            .ToArray();
        Assert.That(ids, Does.Contain(extraPdId));
        Assert.That(ids, Does.Contain(extraTermsId));
        Assert.That(ids, Has.Length.EqualTo(4));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.That(await db.ConsentEvents.CountAsync(e => e.SubjectId == organizerId), Is.EqualTo(4));
    }

    [Test]
    public async Task DeleteAccount_ScrubsIdentity_WithdrawsConsents_AndBlocksLogin()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        using var client = factory.CreateClient();

        var email = $"del-{Guid.NewGuid():N}@example.com";
        var password = "password1";
        var organizerId = await RegisterAsync(client, email, password, "Delete Me");
        var token = await LoginAsync(client, email, password);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var delete = await client.DeleteAsync("/api/organizer/account");
        Assert.That(delete.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), await delete.Content.ReadAsStringAsync());

        using var loginAfter = await client.PostAsync(
            "/auth/login",
            JsonContent(new { email, password }));
        Assert.That(loginAfter.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.That(await db.EmailAccounts.AnyAsync(e => e.Email == email), Is.False);
        var deleted = await db.Organizers.IgnoreQueryFilters().SingleAsync(o => o.Id == organizerId);
        Assert.That(deleted.IsDeleted, Is.True);
        Assert.That(deleted.Name, Is.EqualTo(OrganizerDisplayNames.Deleted));
        Assert.That(
            await db.ConsentEvents.CountAsync(e => e.SubjectId == organizerId && e.Decision == "withdraw"),
            Is.EqualTo(2));
    }

    [Test]
    public async Task MigrationHistory_AppliesLegalRegistrySyncHashes()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        _ = factory.CreateClient();
        await factory.WaitUntilDatabaseReachableAsync();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var applied = (await db.Database.GetAppliedMigrationsAsync()).ToArray();

        Assert.That(applied.Any(m => m.Contains("SyncLegalRegistryFromPublish", StringComparison.Ordinal)), Is.True);
        Assert.That(
            await db.LegalDocumentVersions
                .Where(v => v.Id == SeedPdVersionId)
                .Select(v => v.ContentHash)
                .SingleAsync(),
            Is.EqualTo(SeedPdHashV1));
        Assert.That(
            await db.LegalDocumentVersions
                .Where(v => v.Id == SeedTermsVersionId)
                .Select(v => v.ContentHash)
                .SingleAsync(),
            Is.EqualTo(SeedTermsHashV1));
    }

    [Test]
    public async Task Reconsent_AfterNewActiveVersions_WriteRequiresFreshGrants()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        using var client = factory.CreateClient();

        var email = $"reconsent-{Guid.NewGuid():N}@example.com";
        var password = "password1";
        await RegisterAsync(client, email, password, "Reconsent Organizer");
        var token = await LoginAsync(client, email, password);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var (newPdId, newTermsId, newPdHash, newTermsHash) =
            await RollForwardLegalDocumentsAsync(factory.Services);

        using var blocked = await client.PatchAsync(
            "/api/organizer/profile",
            JsonContent(new { name = "Should Block" }));
        var blockedBody = await blocked.Content.ReadAsStringAsync();
        Assert.That(blocked.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden), blockedBody);
        using var blockedDoc = JsonDocument.Parse(blockedBody);
        Assert.That(blockedDoc.RootElement.GetProperty("code").GetString(), Is.EqualTo("consent_required"));
        var missing = blockedDoc.RootElement.GetProperty("missing").EnumerateArray()
            .Select(e => Guid.Parse(e.GetString()!))
            .ToArray();
        Assert.That(missing, Is.EquivalentTo(new[] { newPdId, newTermsId }));

        using var grant = await client.PostAsync(
            "/api/consent-events",
            JsonContent(new
            {
                events = new object[]
                {
                    new
                    {
                        id = Guid.NewGuid(),
                        legalDocumentVersionId = newPdId,
                        documentHash = newPdHash,
                        decision = "grant"
                    },
                    new
                    {
                        id = Guid.NewGuid(),
                        legalDocumentVersionId = newTermsId,
                        documentHash = newTermsHash,
                        decision = "grant"
                    }
                }
            }));
        Assert.That(grant.StatusCode, Is.EqualTo(HttpStatusCode.Created), await grant.Content.ReadAsStringAsync());

        using var ok = await client.PatchAsync(
            "/api/organizer/profile",
            JsonContent(new { name = "After Reconsent" }));
        var okBody = await ok.Content.ReadAsStringAsync();
        Assert.That(ok.StatusCode, Is.EqualTo(HttpStatusCode.OK), okBody);
    }

    [Test]
    public async Task LegalRollout_StopApp_AddDocuments_Restart_RequiresCheckboxesAgain()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        var email = $"rollout-{Guid.NewGuid():N}@example.com";
        var password = "password1";

        Guid organizerId;
        await using (var factory1 = new IntegrationDbWebApplicationFactory(connectionString))
        {
            using var client1 = factory1.CreateClient();
            organizerId = await RegisterAsync(client1, email, password, "Rollout Organizer");

            using var scope1 = factory1.Services.CreateScope();
            var db1 = scope1.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.That(
                await db1.ConsentEvents.CountAsync(e => e.SubjectId == organizerId && e.Decision == "grant"),
                Is.EqualTo(2));
        }

        // App stopped. Simulate LegalPublish → HasData migration: retire v1, insert new active versions.
        var newPdId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var newTermsId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
        const string newPdHash = "rollout-pd-hash-v2";
        const string newTermsHash = "rollout-terms-hash-v2";
        await ApplyLegalDocumentRolloutMigrationAsync(
            connectionString,
            newPdId,
            newTermsId,
            newPdHash,
            newTermsHash);

        await using var factory2 = new IntegrationDbWebApplicationFactory(connectionString);
        using var client2 = factory2.CreateClient();
        var token = await LoginAsync(client2, email, password);
        client2.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var list = await client2.GetAsync("/api/consent-events");
        var listBody = await list.Content.ReadAsStringAsync();
        Assert.That(list.StatusCode, Is.EqualTo(HttpStatusCode.OK), listBody);
        Assert.That(
            JsonDocument.Parse(listBody).RootElement.GetArrayLength(),
            Is.EqualTo(2),
            "Old grants remain append-only; new required versions are not granted yet.");

        using var blocked = await client2.PatchAsync(
            "/api/organizer/profile",
            JsonContent(new { name = "Need New Checkboxes" }));
        var blockedBody = await blocked.Content.ReadAsStringAsync();
        Assert.That(blocked.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden), blockedBody);
        using var blockedDoc = JsonDocument.Parse(blockedBody);
        Assert.That(blockedDoc.RootElement.GetProperty("code").GetString(), Is.EqualTo("consent_required"));
        var missing = blockedDoc.RootElement.GetProperty("missing").EnumerateArray()
            .Select(e => Guid.Parse(e.GetString()!))
            .ToArray();
        Assert.That(missing, Is.EquivalentTo(new[] { newPdId, newTermsId }));

        using var grant = await client2.PostAsync(
            "/api/consent-events",
            JsonContent(new
            {
                events = new object[]
                {
                    new
                    {
                        id = Guid.NewGuid(),
                        legalDocumentVersionId = newPdId,
                        documentHash = newPdHash,
                        decision = "grant"
                    },
                    new
                    {
                        id = Guid.NewGuid(),
                        legalDocumentVersionId = newTermsId,
                        documentHash = newTermsHash,
                        decision = "grant"
                    }
                }
            }));
        Assert.That(grant.StatusCode, Is.EqualTo(HttpStatusCode.Created), await grant.Content.ReadAsStringAsync());

        using var ok = await client2.PatchAsync(
            "/api/organizer/profile",
            JsonContent(new { name = "Rollout Done" }));
        Assert.That(ok.StatusCode, Is.EqualTo(HttpStatusCode.OK), await ok.Content.ReadAsStringAsync());

        using var scope2 = factory2.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.That(
            await db2.ConsentEvents.CountAsync(e => e.SubjectId == organizerId && e.Decision == "grant"),
            Is.EqualTo(4));
        Assert.That(
            await db2.LegalDocumentVersions.CountAsync(v => v.Status == "active"),
            Is.EqualTo(2));
        Assert.That(
            await db2.LegalDocumentVersions.AnyAsync(v => v.Id == SeedPdVersionId && v.Status == "retired"),
            Is.True);
    }

    private static async Task<Guid> RegisterAsync(
        HttpClient client,
        string email,
        string password,
        string name)
    {
        var payload = BuildRegisterPayload(
            email,
            password,
            name,
            Guid.NewGuid(),
            Guid.NewGuid());
        using var response = await client.PostAsync("/api/organizers", JsonContent(payload));
        var body = await response.Content.ReadAsStringAsync();
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created), body);
        return JsonDocument.Parse(body).RootElement.GetProperty("id").GetGuid();
    }

    private static object BuildRegisterPayload(
        string email,
        string password,
        string name,
        Guid grantPdId,
        Guid grantTermsId) =>
        new
        {
            email,
            password,
            name,
            consents = new object[]
            {
                new
                {
                    id = grantPdId,
                    legalDocumentVersionId = SeedPdVersionId,
                    documentHash = SeedPdHashV1,
                    decision = "grant"
                },
                new
                {
                    id = grantTermsId,
                    legalDocumentVersionId = SeedTermsVersionId,
                    documentHash = SeedTermsHashV1,
                    decision = "grant"
                }
            }
        };

    private static async Task<string> LoginAsync(HttpClient client, string email, string password)
    {
        using var response = await client.PostAsync(
            "/auth/login",
            JsonContent(new { email, password }));
        var body = await response.Content.ReadAsStringAsync();
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
        var token = JsonDocument.Parse(body).RootElement.GetProperty("accessToken").GetString();
        Assert.That(token, Is.Not.Null.And.Not.Empty);
        return token!;
    }

    private static async Task<(Guid NewPdId, Guid NewTermsId, string NewPdHash, string NewTermsHash)>
        RollForwardLegalDocumentsAsync(IServiceProvider services)
    {
        var newPdId = Guid.NewGuid();
        var newTermsId = Guid.NewGuid();
        const string newPdHash = "integration-pd-hash-v2";
        const string newTermsHash = "integration-terms-hash-v2";

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await ApplyRollForwardAsync(db, newPdId, newTermsId, newPdHash, newTermsHash);
        return (newPdId, newTermsId, newPdHash, newTermsHash);
    }

    private static async Task ApplyLegalDocumentRolloutMigrationAsync(
        string connectionString,
        Guid newPdId,
        Guid newTermsId,
        string newPdHash,
        string newTermsHash)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;
        await using var db = new AppDbContext(options);
        await ApplyRollForwardAsync(db, newPdId, newTermsId, newPdHash, newTermsHash);
    }

    private static async Task ApplyRollForwardAsync(
        AppDbContext db,
        Guid newPdId,
        Guid newTermsId,
        string newPdHash,
        string newTermsHash)
    {
        var now = DateTime.UtcNow;
        var active = await db.LegalDocumentVersions.Where(v => v.Status == "active").ToListAsync();
        foreach (var version in active)
        {
            version.Status = "retired";
            version.EffectiveTo = now;
        }

        db.LegalDocumentVersions.Add(new LegalDocumentVersionEf
        {
            Id = newPdId,
            DocumentType = "pd_consent_text",
            DocumentVersion = "2.0",
            ContentHash = newPdHash,
            EffectiveFrom = now,
            EffectiveTo = null,
            Status = "active"
        });
        db.LegalDocumentVersions.Add(new LegalDocumentVersionEf
        {
            Id = newTermsId,
            DocumentType = "terms",
            DocumentVersion = "2.0",
            ContentHash = newTermsHash,
            EffectiveFrom = now,
            EffectiveTo = null,
            Status = "active"
        });

        await db.SaveChangesAsync();
    }

    private static StringContent JsonContent(object payload) =>
        new(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");
}
