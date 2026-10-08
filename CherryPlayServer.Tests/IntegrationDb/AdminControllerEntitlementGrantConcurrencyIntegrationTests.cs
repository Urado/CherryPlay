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
public sealed class AdminControllerEntitlementGrantConcurrencyIntegrationTests
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
    public async Task Grant_ConcurrentCalls_OnlyOneSucceedsAndWritesSingleAuditLog()
    {
        var options = await CreateMigratedOptionsAsync();
        await using var seedDb = new AppDbContext(options);
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        await SeedGrantTargetAsync(seedDb, adminId, organizerId, packageId);

        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var firstReady = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var secondReady = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var firstTask = InvokeConcurrentGrantAsync(options, adminId, organizerId, packageId, firstReady, gate.Task, "first");
        var secondTask = InvokeConcurrentGrantAsync(options, adminId, organizerId, packageId, secondReady, gate.Task, "second");
        await Task.WhenAll(firstReady.Task, secondReady.Task).WaitAsync(TimeSpan.FromSeconds(30));
        gate.SetResult();

        var results = await Task.WhenAll(firstTask, secondTask);
        Assert.That(results.Count(IsCreatedResult), Is.EqualTo(1));
        Assert.That(results.Count(x => !IsCreatedResult(x)), Is.EqualTo(1));
        var nonSuccess = results.Single(x => !IsCreatedResult(x));
        Assert.That(nonSuccess, Is.TypeOf<ConflictObjectResult>());
        var conflict = (ConflictObjectResult)nonSuccess;
        Assert.That(ReadAnonymousProperty<string>(conflict.Value, "code"), Is.EqualTo("entitlement_already_active"));

        var grantLogs = await seedDb.AdminAuditLogs
            .Where(x => x.TargetOrganizerId == organizerId && x.Action == AdminAuditActionNames.GrantPackage)
            .ToListAsync();
        Assert.That(grantLogs, Has.Count.EqualTo(1));
        var entitlements = await seedDb.OrganizerEntitlements.AsNoTracking()
            .Where(x => x.OrganizerId == organizerId && x.PackageId == packageId)
            .ToListAsync();
        Assert.That(entitlements, Has.Count.EqualTo(1));
        Assert.That(entitlements.Single().Note, Is.AnyOf("first", "second"));
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

    private static async Task SeedGrantTargetAsync(
        AppDbContext db, Guid adminId, Guid organizerId, Guid packageId)
    {
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
        await db.SaveChangesAsync();
    }

    private static AdminController CreateController(AppDbContext db, Guid adminId) =>
        AdminControllerTestFactory.Create(db, adminId);

    private static async Task<IActionResult> InvokeConcurrentGrantAsync(
        DbContextOptions<AppDbContext> options, Guid adminId, Guid organizerId, Guid packageId,
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
        var action = await CreateController(db, adminId)
            .Grant(organizerId, new GrantEntitlementRequest(packageId, note));
        return action.Result
            ?? throw new AssertionException("Expected Grant to return an IActionResult.");
    }

    private static bool IsCreatedResult(IActionResult result)
    {
        return result is ObjectResult { StatusCode: 201 };
    }

    private static T ReadAnonymousProperty<T>(object? value, string propertyName)
    {
        if (value is null)
        {
            throw new AssertionException("Expected non-null anonymous object.");
        }

        var property = value.GetType().GetProperty(propertyName)
            ?? throw new AssertionException($"Expected anonymous object to contain property '{propertyName}'.");
        return property.GetValue(value) is T typed
            ? typed
            : throw new AssertionException($"Expected property '{propertyName}' to contain {typeof(T).Name}.");
    }
}
