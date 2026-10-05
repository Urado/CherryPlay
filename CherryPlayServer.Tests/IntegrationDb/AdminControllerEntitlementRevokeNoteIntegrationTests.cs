using CherryPlayServer.Controllers;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Tests.IntegrationDb;

[TestFixture]
[NonParallelizable]
[Category("IntegrationDb")]
public sealed class AdminControllerEntitlementRevokeNoteIntegrationTests
{
    private PostgresContainerFixture? _postgresFixture;

    [OneTimeSetUp]
    public async Task OneTimeSetUp()
    {
        _postgresFixture = new PostgresContainerFixture();
        await _postgresFixture.InitializeAsync();
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown()
    {
        if (_postgresFixture is not null)
        {
            await _postgresFixture.DisposeAsync();
        }
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("   ")]
    public async Task Revoke_NullOrWhitespaceNote_LeavesExistingNoteUnchanged(string? revokeNote)
    {
        var options = await CreateMigratedOptionsAsync();
        await using var db = new AppDbContext(options);
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();
        const string originalNote = "keep-me";
        await SeedEntitlementAsync(db, adminId, organizerId, entitlementId, originalNote);

        var result = await CreateController(db, adminId)
            .Revoke(organizerId, entitlementId, new RevokeEntitlementRequest(revokeNote));
        Assert.That(result, Is.TypeOf<NoContentResult>());

        var updated = await db.OrganizerEntitlements.AsNoTracking().SingleAsync(x => x.Id == entitlementId);
        Assert.That(updated.RevokedAt, Is.Not.Null);
        Assert.That(updated.Note, Is.EqualTo(originalNote));
    }

    [Test]
    public async Task Revoke_NonEmptyNote_AppendsWithExactSeparator()
    {
        var options = await CreateMigratedOptionsAsync();
        await using var db = new AppDbContext(options);
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();
        const string originalNote = "grant-note";
        const string revokeNote = "revoke-reason";
        await SeedEntitlementAsync(db, adminId, organizerId, entitlementId, originalNote);

        var result = await CreateController(db, adminId)
            .Revoke(organizerId, entitlementId, new RevokeEntitlementRequest(revokeNote));
        Assert.That(result, Is.TypeOf<NoContentResult>());

        var updated = await db.OrganizerEntitlements.AsNoTracking().SingleAsync(x => x.Id == entitlementId);
        Assert.That(updated.RevokedAt, Is.Not.Null);
        var expected = $"{originalNote}\n\n--- revoke: {updated.RevokedAt!.Value:O} ---\n{revokeNote}";
        Assert.That(updated.Note, Is.EqualTo(expected));
    }

    private async Task<DbContextOptions<AppDbContext>> CreateMigratedOptionsAsync()
    {
        var fixture = _postgresFixture ?? throw new InvalidOperationException("PostgreSQL fixture is not initialized.");
        var connectionString = await fixture.CreateFreshDatabaseConnectionStringAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;
        await using var migrateDb = new AppDbContext(options);
        await migrateDb.Database.MigrateAsync();
        return options;
    }

    private static async Task SeedEntitlementAsync(
        AppDbContext db, Guid adminId, Guid organizerId, Guid entitlementId, string? note)
    {
        var packageId = Guid.NewGuid();
        db.Organizers.AddRange(
            new OrganizerEf { Id = adminId, Name = $"admin-{adminId:N}", Role = "admin", CreatedAt = DateTime.UtcNow },
            new OrganizerEf { Id = organizerId, Name = $"organizer-{organizerId:N}", Role = "organizer", CreatedAt = DateTime.UtcNow });
        db.ThemePackages.Add(new ThemePackageEf
        {
            Id = packageId,
            Code = "extended",
            Name = "extended",
            IsAutoGranted = false,
            IsActive = true,
            Items = [],
        });
        db.OrganizerEntitlements.Add(new OrganizerEntitlementEf
        {
            Id = entitlementId,
            OrganizerId = organizerId,
            PackageId = packageId,
            GrantedAt = DateTime.UtcNow.AddMinutes(-10),
            Kind = "lifetime",
            Source = "admin_grant",
            Note = note,
        });
        await db.SaveChangesAsync();
    }

    private static AdminController CreateController(AppDbContext db, Guid adminId)
    {
        var controller = new AdminController(db)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.Items["OrganizerId"] = adminId;
        return controller;
    }
}
