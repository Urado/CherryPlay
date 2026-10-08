using System.Net;
using System.Text.Json;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CherryPlayServer.Tests.IntegrationDb;

[TestFixture]
[NonParallelizable]
[Category("IntegrationDb")]
public sealed class PublicPartyCatalogOrganizerIntegrationTests
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
    public async Task PublicPartyCatalogList_ReturnsOrganizerNameInCamelCaseAndExcludesDeletedParties()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        using var client = factory.CreateClient();
        var organizerId = Guid.NewGuid();
        var listedPartyId = Guid.NewGuid();
        var deletedPartyId = Guid.NewGuid();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Organizers.Add(new OrganizerEf
            {
                Id = organizerId,
                Name = "Catalog organizer",
                Role = "organizer",
                CreatedAt = DateTime.UtcNow
            });
            db.Parties.AddRange(
                CreateParty(listedPartyId, organizerId, "CATALOG", isDeleted: false),
                CreateParty(deletedPartyId, organizerId, "DELETED", isDeleted: true));
            await db.SaveChangesAsync();
            db.PartyPlaylists.Add(new PartyPlaylistEf { PartyId = listedPartyId });
            await db.SaveChangesAsync();
        }

        using var response = await client.GetAsync("/api/parties/public/list");
        var body = await response.Content.ReadAsStringAsync();

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
        using var document = JsonDocument.Parse(body);
        var parties = document.RootElement.EnumerateArray().ToArray();
        Assert.That(parties, Has.Length.EqualTo(1));
        Assert.That(parties[0].GetProperty("id").GetString(), Is.EqualTo(listedPartyId.ToString()));
        Assert.That(parties[0].GetProperty("organizerName").GetString(), Is.EqualTo("Catalog organizer"));
    }

    private static PartyEf CreateParty(Guid id, Guid organizerId, string shortCode, bool isDeleted) => new()
    {
        Id = id,
        OrganizerId = organizerId,
        Name = $"Party {shortCode}",
        ShortCode = shortCode,
        PartyThemeId = "basic",
        CreatedAt = DateTime.UtcNow,
        IsListedInCatalog = true,
        IsDeleted = isDeleted,
        PartyLifecycleState = PartyLifecycleState.Ready
    };
}
