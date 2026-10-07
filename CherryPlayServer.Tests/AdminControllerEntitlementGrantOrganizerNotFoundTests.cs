using CherryPlayServer.Controllers;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace CherryPlayServer.Tests;

public sealed class AdminControllerEntitlementGrantOrganizerNotFoundTests
{
    [Test]
    public async Task Grant_MissingOrganizer_ReturnsOrganizerNotFound()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var missingOrganizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        await SeedAdminAndPackageAsync(db, adminId, packageId);

        var action = await CreateController(db, adminId)
            .Grant(missingOrganizerId, new GrantEntitlementRequest(packageId, "missing organizer"));
        Assert.That(action.Result, Is.TypeOf<NotFoundObjectResult>());
        var notFound = (NotFoundObjectResult)action.Result!;
        Assert.That(ReadAnonymousProperty<string>(notFound.Value, "code"), Is.EqualTo("organizer_not_found"));
        Assert.That(await db.OrganizerEntitlements.CountAsync(), Is.EqualTo(0));
    }

    [Test]
    public async Task Grant_SoftDeletedOrganizer_ReturnsOrganizerNotFound()
    {
        await using var db = CreateDbContext();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        await SeedAdminAndPackageAsync(db, adminId, packageId);
        db.Organizers.Add(new OrganizerEf
        {
            Id = organizerId,
            Name = "deleted-organizer",
            Role = "organizer",
            CreatedAt = DateTime.UtcNow,
            IsDeleted = true,
        });
        await db.SaveChangesAsync();

        var action = await CreateController(db, adminId)
            .Grant(organizerId, new GrantEntitlementRequest(packageId, "soft-deleted"));
        Assert.That(action.Result, Is.TypeOf<NotFoundObjectResult>());
        var notFound = (NotFoundObjectResult)action.Result!;
        Assert.That(ReadAnonymousProperty<string>(notFound.Value, "code"), Is.EqualTo("organizer_not_found"));
        Assert.That(await db.OrganizerEntitlements.CountAsync(), Is.EqualTo(0));
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"admin-grant-organizer-{Guid.NewGuid()}")
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static AdminController CreateController(AppDbContext db, Guid adminId) =>
        AdminControllerTestFactory.Create(db, adminId);

    private static async Task SeedAdminAndPackageAsync(AppDbContext db, Guid adminId, Guid packageId)
    {
        db.Organizers.Add(new OrganizerEf
        {
            Id = adminId,
            Name = $"admin-{adminId:N}",
            Role = "admin",
            CreatedAt = DateTime.UtcNow,
        });
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
