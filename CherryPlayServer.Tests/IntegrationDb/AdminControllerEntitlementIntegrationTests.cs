using CherryPlayServer.Controllers;
using CherryPlayServer.Core;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Tests;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Tests.IntegrationDb;

[TestFixture]
[NonParallelizable]
[Category("IntegrationDb")]
public sealed class AdminControllerEntitlementIntegrationTests
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

    [Test]
    public async Task GetOrganizer_WithEntitlements_TranslatesJoinOrderByGrantedAtOnPostgres()
    {
        var options = await CreateMigratedOptionsAsync();
        await using var db = new AppDbContext(options);
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var olderEntitlementId = Guid.NewGuid();
        var newerEntitlementId = Guid.NewGuid();
        var olderGrantedAt = DateTime.UtcNow.AddHours(-2);
        var newerGrantedAt = DateTime.UtcNow.AddHours(-1);
        await SeedOrganizerWithEntitlementsAsync(
            db,
            adminId,
            organizerId,
            (olderEntitlementId, olderGrantedAt, "older"),
            (newerEntitlementId, newerGrantedAt, "newer"));

        var detailAction = await CreateController(db, adminId).GetOrganizer(organizerId);
        Assert.That(detailAction.Result, Is.TypeOf<OkObjectResult>());
        var detail = (AdminOrganizerDetailDto)((OkObjectResult)detailAction.Result!).Value!;
        Assert.That(detail.Entitlements.Select(x => x.Id), Is.EqualTo(new[] { newerEntitlementId, olderEntitlementId }));

        var listAction = await CreateController(db, adminId).GetOrganizerEntitlements(organizerId, status: "all");
        Assert.That(listAction.Result, Is.TypeOf<OkObjectResult>());
        var list = (List<EntitlementDto>)((OkObjectResult)listAction.Result!).Value!;
        Assert.That(list.Select(x => x.Id), Is.EqualTo(new[] { newerEntitlementId, olderEntitlementId }));
    }

    [Test]
    public async Task Revoke_RelationalWhitespaceOnlyOriginalNote_ReplacesWithoutSeparator()
    {
        var options = await CreateMigratedOptionsAsync();
        await using var db = new AppDbContext(options);
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();
        await SeedEntitlementAsync(db, adminId, organizerId, entitlementId, "   ");

        var result = await CreateController(db, adminId)
            .Revoke(organizerId, entitlementId, new RevokeEntitlementRequest("normalized"));
        Assert.That(result, Is.TypeOf<NoContentResult>());

        var updated = await db.OrganizerEntitlements.AsNoTracking().SingleAsync(x => x.Id == entitlementId);
        Assert.That(updated.Note, Is.EqualTo("normalized"));
    }

    [Test]
    public async Task Revoke_ConcurrentCalls_OnlyOneSucceedsAndWritesSingleAuditLog()
    {
        var options = await CreateMigratedOptionsAsync();
        await using var seedDb = new AppDbContext(options);
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();
        await SeedEntitlementAsync(seedDb, adminId, organizerId, entitlementId, null);

        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var firstReady = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var secondReady = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var firstTask = InvokeConcurrentRevokeAsync(options, adminId, organizerId, entitlementId, firstReady, gate.Task, "first");
        var secondTask = InvokeConcurrentRevokeAsync(options, adminId, organizerId, entitlementId, secondReady, gate.Task, "second");
        await Task.WhenAll(firstReady.Task, secondReady.Task).WaitAsync(TimeSpan.FromSeconds(30));
        gate.SetResult();

        var results = await Task.WhenAll(firstTask, secondTask);
        Assert.That(results.Count(x => x is NoContentResult), Is.EqualTo(1));
        Assert.That(results.Count(x => x is not NoContentResult), Is.EqualTo(1));
        var nonSuccess = results.Single(x => x is not NoContentResult);
        Assert.That(nonSuccess, Is.TypeOf<ConflictObjectResult>());
        var conflict = (ConflictObjectResult)nonSuccess;
        Assert.That(ReadAnonymousProperty<string>(conflict.Value, "code"), Is.EqualTo("entitlement_already_revoked"));

        var revokeLogs = await seedDb.AdminAuditLogs
            .Where(x => x.EntitlementId == entitlementId && x.Action == AdminAuditActionNames.RevokePackage)
            .ToListAsync();
        Assert.That(revokeLogs, Has.Count.EqualTo(1));
        var updated = await seedDb.OrganizerEntitlements.AsNoTracking().SingleAsync(x => x.Id == entitlementId);
        Assert.That(updated.RevokedAt, Is.Not.Null);
        Assert.That(updated.Note, Is.AnyOf("first", "second"));
    }

    private async Task<DbContextOptions<AppDbContext>> CreateMigratedOptionsAsync()
    {
        var fixture = _postgresFixture ?? throw new InvalidOperationException("PostgreSQL fixture is not initialized.");
        var connectionString = await fixture.CreateFreshDatabaseConnectionStringAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;
        await using var db = new AppDbContext(options);
        await db.Database.MigrateAsync();
        return options;
    }

    private static async Task SeedEntitlementAsync(
        AppDbContext db, Guid adminId, Guid organizerId, Guid entitlementId, string? note)
    {
        await SeedOrganizerWithEntitlementsAsync(
            db,
            adminId,
            organizerId,
            (entitlementId, DateTime.UtcNow.AddMinutes(-10), note));
    }

    private static async Task SeedOrganizerWithEntitlementsAsync(
        AppDbContext db,
        Guid adminId,
        Guid organizerId,
        params (Guid EntitlementId, DateTime GrantedAt, string? Note)[] entitlements)
    {
        db.Organizers.AddRange(
            new OrganizerEf { Id = adminId, Name = $"admin-{adminId:N}", Role = "admin", CreatedAt = DateTime.UtcNow },
            new OrganizerEf { Id = organizerId, Name = $"organizer-{organizerId:N}", Role = "organizer", CreatedAt = DateTime.UtcNow });
        foreach (var (entitlementId, grantedAt, note) in entitlements)
        {
            var packageId = Guid.NewGuid();
            db.ThemePackages.Add(new ThemePackageEf
            {
                Id = packageId,
                Code = $"pkg-{packageId:N}",
                Name = $"package-{packageId:N}",
                IsAutoGranted = false,
                IsActive = true,
                Items = [],
            });
            db.OrganizerEntitlements.Add(new OrganizerEntitlementEf
            {
                Id = entitlementId,
                OrganizerId = organizerId,
                PackageId = packageId,
                GrantedAt = grantedAt,
                Kind = "lifetime",
                Source = "admin_grant",
                Note = note,
            });
        }

        await db.SaveChangesAsync();
    }

    private static AdminController CreateController(AppDbContext db, Guid adminId) =>
        AdminControllerTestFactory.Create(db, adminId);

    private static async Task<IActionResult> InvokeConcurrentRevokeAsync(
        DbContextOptions<AppDbContext> options, Guid adminId, Guid organizerId, Guid entitlementId,
        TaskCompletionSource ready, Task gate, string note)
    {
        await using var db = new AppDbContext(options);
        try
        {
            await db.Database.OpenConnectionAsync();
            ready.SetResult();
        }
        catch (Exception exception)
        {
            ready.SetException(exception);
            throw;
        }
        await gate;
        return await CreateController(db, adminId).Revoke(organizerId, entitlementId, new RevokeEntitlementRequest(note));
    }

    private static T ReadAnonymousProperty<T>(object? value, string propertyName)
    {
        if (value is null)
        {
            throw new AssertionException("Expected non-null anonymous object.");
        }

        var property = value.GetType().GetProperty(propertyName)
            ?? throw new AssertionException($"Expected anonymous object to contain property '{propertyName}'.");
        return property.GetValue(value) is T result
            ? result
            : throw new AssertionException($"Expected property '{propertyName}' to contain {typeof(T).Name}.");
    }
}
