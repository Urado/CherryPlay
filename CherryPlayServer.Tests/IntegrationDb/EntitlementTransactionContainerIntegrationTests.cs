using CherryPlayServer.Controllers;
using CherryPlayServer.Core;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Tests;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace CherryPlayServer.Tests.IntegrationDb;

[TestFixture]
[NonParallelizable]
[Category("ContainerIntegration")]
public sealed class EntitlementTransactionContainerIntegrationTests
{
    [Test]
    public async Task Grant_WhenAuditInsertFails_RollsBackEntitlement()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
            await SeedGrantTargetAsync(db, adminId, organizerId, packageId);
        }
        await InstallAuditFailureTriggerAsync(database.ConnectionString);

        await using (var db = new AppDbContext(options))
        {
            Assert.ThrowsAsync<DbUpdateException>(() => CreateController(db, adminId)
                .Grant(organizerId, new GrantEntitlementRequest(packageId, "failure test")));
        }

        await using var verifyDb = new AppDbContext(options);
        Assert.That(await verifyDb.OrganizerEntitlements.AnyAsync(item => item.OrganizerId == organizerId), Is.False);
        Assert.That(await verifyDb.AdminAuditLogs.AnyAsync(item => item.TargetOrganizerId == organizerId), Is.False);
    }

    [Test]
    public async Task Revoke_WhenAuditInsertFails_RollsBackEntitlementUpdate()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();
        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
            await SeedGrantTargetAsync(db, adminId, organizerId, packageId);
            db.OrganizerEntitlements.Add(new OrganizerEntitlementEf
            {
                Id = entitlementId,
                OrganizerId = organizerId,
                PackageId = packageId,
                Kind = "lifetime",
                Source = "admin_grant",
                GrantedAt = DateTime.UtcNow.AddMinutes(-10)
            });
            await db.SaveChangesAsync();
        }
        await InstallAuditFailureTriggerAsync(database.ConnectionString);

        await using (var db = new AppDbContext(options))
        {
            Assert.ThrowsAsync<DbUpdateException>(() => CreateController(db, adminId)
                .Revoke(organizerId, entitlementId, new RevokeEntitlementRequest("failure test")));
        }

        await using var verifyDb = new AppDbContext(options);
        var entitlement = await verifyDb.OrganizerEntitlements.AsNoTracking().SingleAsync(item => item.Id == entitlementId);
        Assert.That(entitlement.RevokedAt, Is.Null);
        Assert.That(await verifyDb.AdminAuditLogs.AnyAsync(item => item.EntitlementId == entitlementId), Is.False);
    }

    private static DbContextOptions<AppDbContext> CreateOptions(string connectionString) =>
        new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;

    private static async Task SeedGrantTargetAsync(AppDbContext db, Guid adminId, Guid organizerId, Guid packageId)
    {
        db.Organizers.AddRange(
            new OrganizerEf { Id = adminId, Name = "Transaction admin", Role = "admin", CreatedAt = DateTime.UtcNow },
            new OrganizerEf { Id = organizerId, Name = "Transaction organizer", Role = "organizer", CreatedAt = DateTime.UtcNow });
        db.ThemePackages.Add(new ThemePackageEf
        {
            Id = packageId,
            Code = "transaction-package",
            Name = "Transaction package",
            IsAutoGranted = false,
            IsActive = true,
            Items = []
        });
        await db.SaveChangesAsync();
    }

    private static AdminController CreateController(AppDbContext db, Guid adminId) =>
        AdminControllerTestFactory.Create(db, adminId);

    private static async Task InstallAuditFailureTriggerAsync(string connectionString)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var function = connection.CreateCommand();
        function.CommandText = "CREATE FUNCTION reject_admin_audit_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced audit failure'; END; $$";
        await function.ExecuteNonQueryAsync();
        await using var trigger = connection.CreateCommand();
        trigger.CommandText = "CREATE TRIGGER reject_admin_audit_insert BEFORE INSERT ON admin_audit_log FOR EACH ROW EXECUTE FUNCTION reject_admin_audit_insert()";
        await trigger.ExecuteNonQueryAsync();
    }
}
