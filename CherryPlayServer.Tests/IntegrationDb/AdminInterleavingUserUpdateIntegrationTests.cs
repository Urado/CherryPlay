using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace CherryPlayServer.Tests.IntegrationDb;

[TestFixture]
[NonParallelizable]
[Category("IntegrationDb")]
public sealed class AdminInterleavingUserUpdateIntegrationTests
{
    private PostgresContainerFixture _postgresFixture = null!;

    [OneTimeSetUp]
    public async Task OneTimeSetUp()
    {
        _postgresFixture = new PostgresContainerFixture();
        await _postgresFixture.InitializeAsync();
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown() => await _postgresFixture.DisposeAsync();

    [Test]
    public async Task UserMetadataApiUpdate_PreservesAdminLifecycleChangeThatOccursBeforeSave()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        var options = CreateDbOptions(connectionString);
        var organizerId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var createdAt = DateTime.UtcNow;
        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
            db.Organizers.Add(new OrganizerEf { Id = organizerId, Name = "Interleave organizer", Role = "organizer", CreatedAt = createdAt });
            db.OrganizerSessions.Add(new OrganizerSessionEf { Id = sessionId, OrganizerId = organizerId, CreatedAt = createdAt });
            db.Parties.Add(new PartyEf
            {
                Id = partyId,
                OrganizerId = organizerId,
                Name = "Before user update",
                ShortCode = $"{partyId:N}"[..7],
                PartyThemeId = "basic",
                City = "Moscow",
                CreatedAt = createdAt,
                IsListedInCatalog = true,
                PartyLifecycleState = PartyLifecycleState.Ready
            });
            await db.SaveChangesAsync();
        }

        await using var factory = new AdminInterleavingWebApplicationFactory(connectionString);
        using var client = factory.CreateClient();
        string token;
        using (var scope = factory.Services.CreateScope())
        {
            token = await scope.ServiceProvider.GetRequiredService<IJwtService>()
                .GenerateTokenAsync(organizerId, "Interleave organizer", sessionId, "organizer");
        }
        using (var scope = factory.Services.CreateScope())
        {
            var legalDocuments = scope.ServiceProvider.GetRequiredService<ILegalDocumentsService>();
            var requiredVersions = await legalDocuments.GetRequiredActiveAsync();
            await scope.ServiceProvider.GetRequiredService<IConsentEventRepository>().TryAddBatchAsync(requiredVersions.Select(version => new CherryPlayServer.Core.Entities.ConsentEvent
            {
                Id = Guid.NewGuid(),
                SubjectId = organizerId,
                LegalDocumentVersionId = version.Id,
                DocumentHash = version.ContentHash,
                Decision = ConsentDecision.Grant,
                EventAt = DateTimeOffset.UtcNow
            }).ToArray());
        }

        AdminInterleavingPartyRepository.BeforeUpdateAsync = async updatedPartyId =>
        {
            await using var adminDb = new AppDbContext(options);
            var stored = await adminDb.Parties.SingleAsync(item => item.Id == updatedPartyId);
            stored.PartyLifecycleState = PartyLifecycleState.Completed;
            stored.IsListedInCatalog = false;
            await adminDb.SaveChangesAsync();
        };
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/parties/{partyId}")
            {
                Content = new StringContent(JsonSerializer.Serialize(new { name = "User metadata update" }), Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            using var response = await client.SendAsync(request);
            await using var verifyDb = new AppDbContext(options);
            var finalParty = await verifyDb.Parties.SingleAsync(item => item.Id == partyId);

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), await response.Content.ReadAsStringAsync());
            Assert.That(finalParty.Name, Is.EqualTo("User metadata update"));
            Assert.That(finalParty.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Completed));
            Assert.That(finalParty.IsListedInCatalog, Is.False);
        }
        finally
        {
            AdminInterleavingPartyRepository.BeforeUpdateAsync = null;
        }
    }

    private static DbContextOptions<AppDbContext> CreateDbOptions(string connectionString) =>
        new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connectionString).UseSnakeCaseNamingConvention().Options;
}
