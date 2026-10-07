using CherryPlayServer.Controllers;
using CherryPlayServer.Core;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace CherryPlayServer.Tests;

public class AdminOrganizerSoftDeleteFilterTests
{
    [Test]
    public async Task QueryFilter_HidesSoftDeletedOrganizer_UnlessIgnoreQueryFilters()
    {
        await using var db = CreateDbContext();
        var id = Guid.NewGuid();
        db.Organizers.Add(new OrganizerEf
        {
            Id = id,
            Name = "Gone",
            Role = "organizer",
            CreatedAt = DateTime.UtcNow,
            IsDeleted = true,
        });
        await db.SaveChangesAsync();

        Assert.That(await db.Organizers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id), Is.Null);
        Assert.That(
            await db.Organizers.AsNoTracking().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id),
            Is.Not.Null);
    }

    [Test]
    public async Task GetOrganizers_ExcludesSoftDeleted()
    {
        await using var db = CreateDbContext();
        var liveId = Guid.NewGuid();
        var deletedId = Guid.NewGuid();
        db.Organizers.Add(new OrganizerEf
        {
            Id = liveId,
            Name = "Live",
            Role = "organizer",
            CreatedAt = DateTime.UtcNow,
        });
        db.Organizers.Add(new OrganizerEf
        {
            Id = deletedId,
            Name = OrganizerDisplayNames.Deleted,
            Role = "organizer",
            CreatedAt = DateTime.UtcNow,
            IsDeleted = true,
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, liveId);
        var action = await controller.GetOrganizers(query: null);
        Assert.That(action.Result, Is.TypeOf<OkObjectResult>());
        var ok = (OkObjectResult)action.Result!;
        var dto = (Models.AdminOrganizerListDto)ok.Value!;
        Assert.That(dto.Items.Select(x => x.Id), Does.Contain(liveId));
        Assert.That(dto.Items.Select(x => x.Id), Does.Not.Contain(deletedId));
    }

    [Test]
    public async Task GetOrganizer_SoftDeletedTarget_ReturnsNotFound()
    {
        await using var db = CreateDbContext();
        var deletedId = Guid.NewGuid();
        db.Organizers.Add(new OrganizerEf
        {
            Id = deletedId,
            Name = OrganizerDisplayNames.Deleted,
            Role = "organizer",
            CreatedAt = DateTime.UtcNow,
            IsDeleted = true,
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, Guid.NewGuid());
        var action = await controller.GetOrganizer(deletedId);
        Assert.That(action.Result, Is.TypeOf<NotFoundObjectResult>());
    }

    [Test]
    public async Task GetOrganizer_ResolvesHistoricalAdminName_WhenAdminSoftDeleted()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var entitlementId = Guid.NewGuid();

        db.Organizers.Add(new OrganizerEf
        {
            Id = adminId,
            Name = "Historical Admin",
            Role = "admin",
            CreatedAt = DateTime.UtcNow,
            IsDeleted = true,
        });
        db.Organizers.Add(new OrganizerEf
        {
            Id = organizerId,
            Name = "Live Target",
            Role = "organizer",
            CreatedAt = DateTime.UtcNow,
        });
        db.ThemePackages.Add(new ThemePackageEf
        {
            Id = packageId,
            Code = "extended",
            Name = "Extended",
            IsAutoGranted = false,
            IsActive = true,
        });
        db.OrganizerEntitlements.Add(new OrganizerEntitlementEf
        {
            Id = entitlementId,
            OrganizerId = organizerId,
            PackageId = packageId,
            Kind = "lifetime",
            Source = "admin_grant",
            GrantedAt = DateTime.UtcNow.AddDays(-1),
        });
        db.AdminAuditLogs.Add(new AdminAuditLogEf
        {
            Id = Guid.NewGuid(),
            AdminId = adminId,
            Action = AdminAuditActionNames.GrantPackage,
            TargetOrganizerId = organizerId,
            PackageId = packageId,
            EntitlementId = entitlementId,
            CreatedAt = DateTime.UtcNow.AddDays(-1),
        });
        await db.SaveChangesAsync();

        var controller = CreateController(db, organizerId);
        var action = await controller.GetOrganizer(organizerId);
        Assert.That(action.Result, Is.TypeOf<OkObjectResult>());
        var ok = (OkObjectResult)action.Result!;
        var detail = (Models.AdminOrganizerDetailDto)ok.Value!;
        Assert.That(detail.Entitlements, Has.Count.EqualTo(1));
        Assert.That(detail.Entitlements[0].GrantedByAdminName, Is.EqualTo("Historical Admin"));
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"admin-soft-delete-{Guid.NewGuid()}")
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static AdminController CreateController(AppDbContext db, Guid adminId) =>
        AdminControllerTestFactory.Create(db, adminId);
}
