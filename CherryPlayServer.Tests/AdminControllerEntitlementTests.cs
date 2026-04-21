using CherryPlayServer.Controllers;
using CherryPlayServer.Core.Authorization;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;

namespace CherryPlayServer.Tests;

public class AdminControllerEntitlementTests
{
    [Fact]
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
        var created = Assert.IsType<ObjectResult>(action.Result);
        Assert.Equal(201, created.StatusCode);

        var dto = Assert.IsType<EntitlementDto>(created.Value);
        Assert.Equal(packageId, dto.PackageId);
        Assert.Equal("extended", dto.PackageCode);
        Assert.Equal("lifetime", dto.Kind);
        Assert.Equal("admin_grant", dto.Source);
        Assert.Equal(adminId, dto.GrantedByAdminId);
        Assert.Equal("manual grant", dto.Note);

        var stored = await db.OrganizerEntitlements.SingleAsync();
        Assert.Equal(organizerId, stored.OrganizerId);
        Assert.Equal(packageId, stored.PackageId);
    }

    [Fact]
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
        var conflict = Assert.IsType<ConflictObjectResult>(action.Result);
        Assert.Equal("entitlement_already_active", ReadAnonymousProperty<string>(conflict.Value, "code"));
        Assert.Equal(existingEntitlementId, ReadAnonymousProperty<Guid>(conflict.Value, "existingEntitlementId"));
    }

    [Fact]
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
        var badRequest = Assert.IsType<BadRequestObjectResult>(action.Result);
        Assert.Equal("package_is_auto_granted", ReadAnonymousProperty<string>(badRequest.Value, "code"));
        Assert.Empty(db.OrganizerEntitlements);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
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
        var notFound = Assert.IsType<NotFoundObjectResult>(action.Result);
        Assert.Equal("package_not_found", ReadAnonymousProperty<string>(notFound.Value, "code"));
        Assert.Empty(db.OrganizerEntitlements);
    }

    [Fact]
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
        Assert.IsType<NoContentResult>(action);

        var updated = await db.OrganizerEntitlements.SingleAsync(x => x.Id == entitlementId);
        Assert.NotNull(updated.RevokedAt);
        Assert.Equal(adminId, updated.RevokedByAdminId);
        Assert.Contains("after", updated.Note);
    }

    [Fact]
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
        var conflict = Assert.IsType<ConflictObjectResult>(action);
        Assert.Equal("entitlement_already_revoked", ReadAnonymousProperty<string>(conflict.Value, "code"));
    }

    [Fact]
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
        var notFound = Assert.IsType<NotFoundObjectResult>(action);
        Assert.Equal("entitlement_not_found", ReadAnonymousProperty<string>(notFound.Value, "code"));
    }

    [Fact]
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
        var log = Assert.Single(logs);
        Assert.Equal("grant_package", log.Action);
        Assert.Equal(adminId, log.AdminId);
        Assert.Equal(organizerId, log.TargetOrganizerId);
    }

    [Fact]
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
        var log = Assert.Single(logs);
        Assert.Equal("revoke_package", log.Action);
        Assert.Equal(adminId, log.AdminId);
        Assert.Equal(entitlementId, log.EntitlementId);
    }

    [Fact]
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

        Assert.Empty(await db.AdminAuditLogs.ToListAsync());
    }

    [Fact]
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

        Assert.False(context.HasSucceeded);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"admin-tests-{Guid.NewGuid()}")
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

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
            CreatedAt = DateTime.UtcNow,
            Items = [],
        });
        await db.SaveChangesAsync();
    }

    private static T ReadAnonymousProperty<T>(object? value, string propertyName)
    {
        Assert.NotNull(value);
        var property = value.GetType().GetProperty(propertyName);
        Assert.NotNull(property);
        return (T)property.GetValue(value)!;
    }

    private static IServiceScopeFactory CreateScopeFactory(IOrganizerRepository organizerRepository)
    {
        var services = new ServiceCollection();
        services.AddScoped(_ => organizerRepository);
        return services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
    }

    private sealed class StubOrganizerRepository(Organizer? organizer) : IOrganizerRepository
    {
        public Task<Organizer?> GetByIdAsync(Guid id) => Task.FromResult(organizer?.Id == id ? organizer : null);
        public Task<Organizer> AddAsync(Organizer organizerToAdd) => Task.FromResult(organizerToAdd);
        public Task UpdateAsync(Organizer organizerToUpdate) => Task.CompletedTask;
        public Task DeleteAsync(Guid id) => Task.CompletedTask;
    }
}
