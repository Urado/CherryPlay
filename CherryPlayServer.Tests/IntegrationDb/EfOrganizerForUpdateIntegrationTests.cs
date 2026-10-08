using CherryPlayServer.Core;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Tests.IntegrationDb;

/// <summary>
/// Postgres smoke: GetByIdForUpdateAsync must not wrap FOR UPDATE as a filtered subquery
/// after Organizer global query filters are enabled.
/// </summary>
[TestFixture]
[NonParallelizable]
[Category("IntegrationDb")]
public sealed class EfOrganizerForUpdateIntegrationTests
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
    public async Task GetByIdForUpdate_ThenSoftDelete_WorksWithQueryFilters()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;

        await using var db = new AppDbContext(options);
        await db.Database.MigrateAsync();

        var id = Guid.NewGuid();
        db.Organizers.Add(new OrganizerEf
        {
            Id = id,
            Name = "ForUpdate Target",
            Role = "organizer",
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        var repo = new EfOrganizerRepository(db);
        await using var tx = await db.Database.BeginTransactionAsync();

        var locked = await repo.GetByIdForUpdateAsync(id);
        Assert.That(locked, Is.Not.Null);
        Assert.That(locked!.Id, Is.EqualTo(id));

        OrganizerAccountScrub.Apply(locked);
        await repo.UpdateAsync(locked);
        await repo.DeleteAsync(id);
        await tx.CommitAsync();

        Assert.That(await repo.GetByIdAsync(id), Is.Null);
        Assert.That(await repo.GetByIdForUpdateAsync(id), Is.Null);

        var deleted = await repo.GetByIdAsync(id, includeDeleted: true);
        Assert.That(deleted, Is.Not.Null);
        Assert.That(deleted!.Name, Is.EqualTo(OrganizerDisplayNames.Deleted));
    }
}
