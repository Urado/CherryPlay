using CherryPlayServer.Controllers;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Authorization;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Models;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;

namespace CherryPlayServer.Tests;

public class AdminControllerEntitlementTests
{
    [Test]
    public async Task Grant_Success_CreatesEntitlementWithExpectedFields()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await SeedPackageAsync(db, packageId, "extended", isAutoGranted: false, isActive: true);

        var controller = CreateController(db, adminId);
        var action = await controller.Grant(organizerId, new GrantEntitlementRequest(packageId, "manual grant"));
        Assert.That(action.Result, Is.TypeOf<ObjectResult>());
        var created = (ObjectResult)action.Result!;
        Assert.That(created.StatusCode, Is.EqualTo(201));

        Assert.That(created.Value, Is.TypeOf<EntitlementDto>());
        var dto = (EntitlementDto)created.Value!;
        Assert.That(dto.PackageId, Is.EqualTo(packageId));
        Assert.That(dto.PackageCode, Is.EqualTo("extended"));
        Assert.That(dto.Kind, Is.EqualTo("lifetime"));
        Assert.That(dto.Source, Is.EqualTo("admin_grant"));
        Assert.That(dto.GrantedByAdminId, Is.EqualTo(adminId));
        Assert.That(dto.GrantedByAdminName, Does.StartWith("admin-"));
        Assert.That(dto.Note, Is.EqualTo("manual grant"));

        var stored = await db.OrganizerEntitlements.SingleAsync();
        Assert.That(stored.OrganizerId, Is.EqualTo(organizerId));
        Assert.That(stored.PackageId, Is.EqualTo(packageId));
    }

    [Test]
    public async Task Grant_DuplicateActiveGrant_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var existingEntitlementId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await SeedPackageAsync(db, packageId, "extended", isAutoGranted: false, isActive: true);
        db.OrganizerEntitlements.Add(new OrganizerEntitlementEf
        {
            Id = existingEntitlementId,
            OrganizerId = organizerId,
            PackageId = packageId,
            GrantedAt = DateTime.UtcNow.AddMinutes(-5),
            Kind = "lifetime",
            Source = "admin_grant",
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId);
        var action = await controller.Grant(organizerId, new GrantEntitlementRequest(packageId, "duplicate"));
        Assert.That(action.Result, Is.TypeOf<ConflictObjectResult>());
        var conflict = (ConflictObjectResult)action.Result!;
        Assert.That(ReadAnonymousProperty<string>(conflict.Value, "code"), Is.EqualTo("entitlement_already_active"));
        Assert.That(ReadAnonymousProperty<Guid>(conflict.Value, "existingEntitlementId"), Is.EqualTo(existingEntitlementId));
    }

    [Test]
    public async Task Grant_AutoGrantedPackage_ReturnsBadRequest()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await SeedPackageAsync(db, packageId, "free", isAutoGranted: true, isActive: true);

        var controller = CreateController(db, adminId);
        var action = await controller.Grant(organizerId, new GrantEntitlementRequest(packageId, "should fail"));
        Assert.That(action.Result, Is.TypeOf<BadRequestObjectResult>());
        var badRequest = (BadRequestObjectResult)action.Result!;
        Assert.That(ReadAnonymousProperty<string>(badRequest.Value, "code"), Is.EqualTo("package_is_auto_granted"));
        Assert.That(db.OrganizerEntitlements, Is.Empty);
    }

    [TestCase(true)]
    [TestCase(false)]
    public async Task Grant_MissingOrInactivePackage_ReturnsNotFound(bool createInactivePackage)
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        if (createInactivePackage)
        {
            await SeedPackageAsync(db, packageId, "legacy", isAutoGranted: false, isActive: false);
        }

        var controller = CreateController(db, adminId);
        var action = await controller.Grant(organizerId, new GrantEntitlementRequest(packageId, "missing"));
        Assert.That(action.Result, Is.TypeOf<NotFoundObjectResult>());
        var notFound = (NotFoundObjectResult)action.Result!;
        Assert.That(ReadAnonymousProperty<string>(notFound.Value, "code"), Is.EqualTo("package_not_found"));
        Assert.That(db.OrganizerEntitlements, Is.Empty);
    }

    [Test]
    public async Task Revoke_Success_MarksRevokedFields()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await SeedPackageAsync(db, packageId, "extended", isAutoGranted: false, isActive: true);
        db.OrganizerEntitlements.Add(new OrganizerEntitlementEf
        {
            Id = entitlementId,
            OrganizerId = organizerId,
            PackageId = packageId,
            GrantedAt = DateTime.UtcNow.AddMinutes(-10),
            Kind = "lifetime",
            Source = "admin_grant",
            Note = "before",
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId);
        var action = await controller.Revoke(organizerId, entitlementId, new RevokeEntitlementRequest("after"));
        Assert.That(action, Is.TypeOf<NoContentResult>());

        var updated = await db.OrganizerEntitlements.SingleAsync(x => x.Id == entitlementId);
        Assert.That(updated.RevokedAt, Is.Not.Null);
        Assert.That(updated.Note, Does.Contain("after"));

        var revokeAudit = await db.AdminAuditLogs.SingleAsync(x =>
            x.Action == AdminAuditActionNames.RevokePackage &&
            x.EntitlementId == entitlementId);
        Assert.That(revokeAudit.AdminId, Is.EqualTo(adminId));
    }

    [Test]
    public async Task GetOrganizer_WithNoEntitlements_ReturnsEmptyEntitlements()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await db.AdminAuditLogs.AddAsync(new AdminAuditLogEf
        {
            Id = Guid.NewGuid(),
            AdminId = adminId,
            Action = AdminAuditActionNames.GrantPackage,
            TargetOrganizerId = organizerId,
            PackageId = Guid.NewGuid(),
            EntitlementId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId);
        var action = await controller.GetOrganizer(organizerId);
        Assert.That(action.Result, Is.TypeOf<OkObjectResult>());
        var ok = (OkObjectResult)action.Result!;
        Assert.That(ok.Value, Is.TypeOf<AdminOrganizerDetailDto>());
        var dto = (AdminOrganizerDetailDto)ok.Value!;
        Assert.That(dto.Entitlements, Is.Empty);
    }

    [Test]
    public async Task GetOrganizer_MapsGrantAndRevokeAttributionFromAuditLogs()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var revokeAdminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, revokeAdminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await SeedPackageAsync(db, packageId, "extended", isAutoGranted: false, isActive: true);
        db.OrganizerEntitlements.Add(new OrganizerEntitlementEf
        {
            Id = entitlementId,
            OrganizerId = organizerId,
            PackageId = packageId,
            GrantedAt = DateTime.UtcNow.AddMinutes(-10),
            RevokedAt = DateTime.UtcNow.AddMinutes(-1),
            Kind = "lifetime",
            Source = "admin_grant",
            Note = "audit-linked"
        });
        db.AdminAuditLogs.AddRange(
            new AdminAuditLogEf
            {
                Id = Guid.NewGuid(),
                AdminId = adminId,
                Action = AdminAuditActionNames.GrantPackage,
                TargetOrganizerId = organizerId,
                PackageId = packageId,
                EntitlementId = entitlementId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-9)
            },
            new AdminAuditLogEf
            {
                Id = Guid.NewGuid(),
                AdminId = revokeAdminId,
                Action = AdminAuditActionNames.RevokePackage,
                TargetOrganizerId = organizerId,
                PackageId = packageId,
                EntitlementId = entitlementId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-1)
            });
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId);
        var action = await controller.GetOrganizer(organizerId);
        Assert.That(action.Result, Is.TypeOf<OkObjectResult>());
        var ok = (OkObjectResult)action.Result!;
        Assert.That(ok.Value, Is.TypeOf<AdminOrganizerDetailDto>());
        var dto = (AdminOrganizerDetailDto)ok.Value!;
        Assert.That(dto.Entitlements, Has.Count.EqualTo(1));
        var entitlement = dto.Entitlements.Single();

        Assert.That(entitlement.GrantedByAdminId, Is.EqualTo(adminId));
        Assert.That(entitlement.GrantedByAdminName, Does.StartWith("admin-"));
        Assert.That(entitlement.RevokedByAdminId, Is.EqualTo(revokeAdminId));
    }

    [Test]
    public async Task Revoke_AlreadyRevoked_ReturnsConflict()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await SeedPackageAsync(db, packageId, "extended", isAutoGranted: false, isActive: true);
        db.OrganizerEntitlements.Add(new OrganizerEntitlementEf
        {
            Id = entitlementId,
            OrganizerId = organizerId,
            PackageId = packageId,
            GrantedAt = DateTime.UtcNow.AddMinutes(-10),
            RevokedAt = DateTime.UtcNow.AddMinutes(-1),
            Kind = "lifetime",
            Source = "admin_grant",
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId);
        var action = await controller.Revoke(organizerId, entitlementId, new RevokeEntitlementRequest("again"));
        Assert.That(action, Is.TypeOf<ConflictObjectResult>());
        var conflict = (ConflictObjectResult)action;
        Assert.That(ReadAnonymousProperty<string>(conflict.Value, "code"), Is.EqualTo("entitlement_already_revoked"));
    }

    [Test]
    public async Task Revoke_WrongOrganizer_ReturnsNotFound()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var otherOrganizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await SeedOrganizerAsync(db, otherOrganizerId, "organizer");
        await SeedPackageAsync(db, packageId, "extended", isAutoGranted: false, isActive: true);
        db.OrganizerEntitlements.Add(new OrganizerEntitlementEf
        {
            Id = entitlementId,
            OrganizerId = organizerId,
            PackageId = packageId,
            GrantedAt = DateTime.UtcNow.AddMinutes(-10),
            Kind = "lifetime",
            Source = "admin_grant",
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId);
        var action = await controller.Revoke(otherOrganizerId, entitlementId, new RevokeEntitlementRequest("wrong target"));
        Assert.That(action, Is.TypeOf<NotFoundObjectResult>());
        var notFound = (NotFoundObjectResult)action;
        Assert.That(ReadAnonymousProperty<string>(notFound.Value, "code"), Is.EqualTo("entitlement_not_found"));
    }

    [Test]
    public async Task AuditLog_SuccessfulGrant_WritesExactlyOneRecord()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await SeedPackageAsync(db, packageId, "extended", isAutoGranted: false, isActive: true);

        var controller = CreateController(db, adminId);
        await controller.Grant(organizerId, new GrantEntitlementRequest(packageId, "audit grant"));

        var logs = await db.AdminAuditLogs.ToListAsync();
        Assert.That(logs, Has.Count.EqualTo(1));
        var log = logs.Single();
        Assert.That(log.Action, Is.EqualTo(AdminAuditActionNames.GrantPackage));
        Assert.That(log.AdminId, Is.EqualTo(adminId));
        Assert.That(log.TargetOrganizerId, Is.EqualTo(organizerId));
    }

    [Test]
    public async Task AuditLog_SuccessfulRevoke_WritesExactlyOneRecord()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await SeedPackageAsync(db, packageId, "extended", isAutoGranted: false, isActive: true);
        db.OrganizerEntitlements.Add(new OrganizerEntitlementEf
        {
            Id = entitlementId,
            OrganizerId = organizerId,
            PackageId = packageId,
            GrantedAt = DateTime.UtcNow.AddMinutes(-10),
            Kind = "lifetime",
            Source = "admin_grant",
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId);
        await controller.Revoke(organizerId, entitlementId, new RevokeEntitlementRequest("audit revoke"));

        var logs = await db.AdminAuditLogs.ToListAsync();
        Assert.That(logs, Has.Count.EqualTo(1));
        var log = logs.Single();
        Assert.That(log.Action, Is.EqualTo(AdminAuditActionNames.RevokePackage));
        Assert.That(log.AdminId, Is.EqualTo(adminId));
        Assert.That(log.EntitlementId, Is.EqualTo(entitlementId));
    }

    [Test]
    public async Task Revoke_RepeatedCall_IsDeterministicAndDoesNotDuplicateAudit()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await SeedPackageAsync(db, packageId, "extended", isAutoGranted: false, isActive: true);
        db.OrganizerEntitlements.Add(new OrganizerEntitlementEf
        {
            Id = entitlementId,
            OrganizerId = organizerId,
            PackageId = packageId,
            GrantedAt = DateTime.UtcNow.AddMinutes(-10),
            Kind = "lifetime",
            Source = "admin_grant",
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId);
        var first = await controller.Revoke(organizerId, entitlementId, new RevokeEntitlementRequest("first"));
        Assert.That(first, Is.TypeOf<NoContentResult>());

        var second = await controller.Revoke(organizerId, entitlementId, new RevokeEntitlementRequest("second"));
        Assert.That(second, Is.TypeOf<ConflictObjectResult>());
        var conflict = (ConflictObjectResult)second;
        Assert.That(ReadAnonymousProperty<string>(conflict.Value, "code"), Is.EqualTo("entitlement_already_revoked"));

        var logs = await db.AdminAuditLogs
            .Where(x => x.EntitlementId == entitlementId && x.Action == AdminAuditActionNames.RevokePackage)
            .ToListAsync();
        Assert.That(logs, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task Revoke_SecondCall_DoesNotMutateAlreadyRevokedNote()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await SeedPackageAsync(db, packageId, "extended", isAutoGranted: false, isActive: true);
        db.OrganizerEntitlements.Add(new OrganizerEntitlementEf
        {
            Id = entitlementId,
            OrganizerId = organizerId,
            PackageId = packageId,
            GrantedAt = DateTime.UtcNow.AddMinutes(-10),
            Kind = "lifetime",
            Source = "admin_grant",
            Note = "initial",
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId);
        var first = await controller.Revoke(organizerId, entitlementId, new RevokeEntitlementRequest("first"));
        Assert.That(first, Is.TypeOf<NoContentResult>());

        var noteAfterFirst = (await db.OrganizerEntitlements.SingleAsync(x => x.Id == entitlementId)).Note;
        var second = await controller.Revoke(organizerId, entitlementId, new RevokeEntitlementRequest("second"));
        Assert.That(second, Is.TypeOf<ConflictObjectResult>());
        var conflict = (ConflictObjectResult)second;
        Assert.That(ReadAnonymousProperty<string>(conflict.Value, "code"), Is.EqualTo("entitlement_already_revoked"));

        var noteAfterSecond = (await db.OrganizerEntitlements.SingleAsync(x => x.Id == entitlementId)).Note;
        Assert.That(noteAfterSecond, Is.EqualTo(noteAfterFirst));
    }

    [Test]
    public async Task Revoke_RelationalWhitespaceOnlyOriginalNote_ReplacesWithoutSeparator()
    {
        var connectionString = $"Data Source=file:revoke-note-whitespace-{Guid.NewGuid():N}?mode=memory&cache=shared&Default Timeout=15";
        await using var keeperConnection = new SqliteConnection(connectionString);
        await keeperConnection.OpenAsync();
        var options = CreateSqliteDbContextOptions(connectionString);

        await using var db = CreateDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await SeedPackageAsync(db, packageId, "extended", isAutoGranted: false, isActive: true);
        db.OrganizerEntitlements.Add(new OrganizerEntitlementEf
        {
            Id = entitlementId,
            OrganizerId = organizerId,
            PackageId = packageId,
            GrantedAt = DateTime.UtcNow.AddMinutes(-10),
            Kind = "lifetime",
            Source = "admin_grant",
            Note = "   "
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, adminId);
        var result = await controller.Revoke(organizerId, entitlementId, new RevokeEntitlementRequest("normalized"));
        Assert.That(result, Is.TypeOf<NoContentResult>());

        var updated = await db.OrganizerEntitlements.AsNoTracking().SingleAsync(x => x.Id == entitlementId);
        Assert.That(updated.Note, Is.EqualTo("normalized"));
    }

    [Test]
    public async Task Revoke_ConcurrentCalls_OnlyOneSucceedsAndWritesSingleAuditLog()
    {
        var connectionString = $"Data Source=file:revoke-concurrency-{Guid.NewGuid():N}?mode=memory&cache=shared&Default Timeout=15";
        await using var keeperConnection = new SqliteConnection(connectionString);
        await keeperConnection.OpenAsync();
        var options = CreateSqliteDbContextOptions(connectionString);

        await using (var seedDb = CreateDbContext(options))
        {
            await seedDb.Database.EnsureCreatedAsync();

            var adminId = Guid.NewGuid();
            var organizerId = Guid.NewGuid();
            var packageId = Guid.NewGuid();
            var entitlementId = Guid.NewGuid();
            await SeedOrganizerAsync(seedDb, adminId, "admin");
            await SeedOrganizerAsync(seedDb, organizerId, "organizer");
            await SeedPackageAsync(seedDb, packageId, "extended", isAutoGranted: false, isActive: true);
            seedDb.OrganizerEntitlements.Add(new OrganizerEntitlementEf
            {
                Id = entitlementId,
                OrganizerId = organizerId,
                PackageId = packageId,
                GrantedAt = DateTime.UtcNow.AddMinutes(-10),
                Kind = "lifetime",
                Source = "admin_grant",
            });
            await seedDb.SaveChangesAsync();

            var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var firstTask = InvokeConcurrentRevokeAsync(options, adminId, organizerId, entitlementId, gate.Task, "first");
            var secondTask = InvokeConcurrentRevokeAsync(options, adminId, organizerId, entitlementId, gate.Task, "second");
            gate.SetResult();

            var results = await Task.WhenAll(firstTask, secondTask);
            Assert.That(results.Count(x => x is NoContentResult), Is.EqualTo(1));

            Assert.That(results.Count(x => x is not NoContentResult), Is.EqualTo(1));
            var nonSuccess = results.Single(x => x is not NoContentResult);
            if (nonSuccess is ConflictObjectResult conflict)
            {
                Assert.That(ReadAnonymousProperty<string>(conflict.Value, "code"), Is.EqualTo("entitlement_already_revoked"));
            }
            else
            {
                Assert.That(nonSuccess, Is.TypeOf<NotFoundObjectResult>());
                var notFound = (NotFoundObjectResult)nonSuccess;
                Assert.That(ReadAnonymousProperty<string>(notFound.Value, "code"), Is.EqualTo("entitlement_not_found"));
            }

            var revokeLogs = await seedDb.AdminAuditLogs
                .Where(x => x.EntitlementId == entitlementId && x.Action == AdminAuditActionNames.RevokePackage)
                .ToListAsync();
            Assert.That(revokeLogs, Has.Count.EqualTo(1));
        }
    }

    [Test]
    public async Task AuditLog_FailedGrantOrRevoke_DoesNotWriteAnyRecord()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        await SeedOrganizerAsync(db, adminId, "admin");
        await SeedOrganizerAsync(db, organizerId, "organizer");
        await SeedPackageAsync(db, packageId, "free", isAutoGranted: true, isActive: true);

        var controller = CreateController(db, adminId);
        await controller.Grant(organizerId, new GrantEntitlementRequest(packageId, "fail"));
        await controller.Revoke(organizerId, Guid.NewGuid(), new RevokeEntitlementRequest("fail"));

        Assert.That(await db.AdminAuditLogs.ToListAsync(), Is.Empty);
    }

    [Test]
    public async Task AdminAuthorizationHandler_NonAdminInDatabase_IsDenied()
    {
        var organizerId = Guid.NewGuid();
        var scopeFactory = CreateScopeFactory(new StubOrganizerRepository(new Organizer
        {
            Id = organizerId,
            Name = "Not admin",
            Role = OrganizerRole.Organizer,
        }));
        var handler = new AdminAuthorizationHandler(scopeFactory);

        var httpContext = new DefaultHttpContext();
        httpContext.Items["OrganizerId"] = organizerId;
        httpContext.Items["OrganizerRole"] = "admin";
        var context = new AuthorizationHandlerContext([new AdminRequirement()], new System.Security.Claims.ClaimsPrincipal(), httpContext);

        await handler.HandleAsync(context);

        Assert.That(context.HasSucceeded, Is.False);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"admin-tests-{Guid.NewGuid()}")
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static AppDbContext CreateDbContext(DbContextOptions<AppDbContext> options) => new(options);

    private static DbContextOptions<AppDbContext> CreateSqliteDbContextOptions(string connectionString) =>
        new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connectionString)
            .Options;

    private static AdminController CreateController(AppDbContext db, Guid adminId)
    {
        var controller = new AdminController(db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext(),
        };
        controller.HttpContext.Items["OrganizerId"] = adminId;
        return controller;
    }

    private static async Task SeedOrganizerAsync(AppDbContext db, Guid organizerId, string role)
    {
        db.Organizers.Add(new OrganizerEf
        {
            Id = organizerId,
            Name = $"{role}-{organizerId:N}",
            Role = role,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    private static async Task SeedPackageAsync(AppDbContext db, Guid packageId, string code, bool isAutoGranted, bool isActive)
    {
        db.ThemePackages.Add(new ThemePackageEf
        {
            Id = packageId,
            Code = code,
            Name = code,
            IsAutoGranted = isAutoGranted,
            IsActive = isActive,
            Items = [],
        });
        await db.SaveChangesAsync();
    }

    private static T ReadAnonymousProperty<T>(object? value, string propertyName)
    {
        if (value is null)
        {
            throw new AssertionException("Expected non-null anonymous object.");
        }

        var property = value.GetType().GetProperty(propertyName);
        if (property is null)
        {
            throw new AssertionException($"Expected anonymous object to contain property '{propertyName}'.");
        }

        return (T)property.GetValue(value)!;
    }

    private static IServiceScopeFactory CreateScopeFactory(IOrganizerRepository organizerRepository)
    {
        var services = new ServiceCollection();
        services.AddScoped(_ => organizerRepository);
        return services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
    }

    private static async Task<IActionResult> InvokeConcurrentRevokeAsync(
        DbContextOptions<AppDbContext> options,
        Guid adminId,
        Guid organizerId,
        Guid entitlementId,
        Task gate,
        string note)
    {
        await gate;
        return await ExecuteWithSqliteLockRetryAsync(async () =>
        {
            await using var db = CreateDbContext(options);
            var controller = CreateController(db, adminId);
            return await controller.Revoke(organizerId, entitlementId, new RevokeEntitlementRequest(note));
        });
    }

    private static async Task<IActionResult> ExecuteWithSqliteLockRetryAsync(Func<Task<IActionResult>> action)
    {
        const int maxAttempts = 3;
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                return await action();
            }
            catch (DbUpdateException ex) when (attempt < maxAttempts && ex.InnerException is SqliteException sqliteEx && sqliteEx.SqliteErrorCode == 5)
            {
                await Task.Delay(25 * attempt);
            }
        }

        return await action();
    }

    private sealed class StubOrganizerRepository(Organizer? organizer) : IOrganizerRepository
    {
        public Task<Organizer?> GetByIdAsync(Guid id) => Task.FromResult(organizer?.Id == id ? organizer : null);
        public Task<Organizer> AddAsync(Organizer organizerToAdd) => Task.FromResult(organizerToAdd);
        public Task UpdateAsync(Organizer organizerToUpdate) => Task.CompletedTask;
        public Task DeleteAsync(Guid id) => Task.CompletedTask;
    }

    [Test]
    public void AdminAuditActionNames_UnknownAction_Throws()
    {
        var unknownAction = (AdminAuditAction)999;
        Assert.Throws<ArgumentOutOfRangeException>(() => AdminAuditActionNames.ToStorageValue(unknownAction));
    }
}
