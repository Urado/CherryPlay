using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Infrastructure.Repositories;

namespace CherryPlayServer.Tests;

/// <summary>
/// InMemory soft-delete must mirror EF query-filter behaviour — account-deletion tests rely on it.
/// </summary>
public class InMemoryOrganizerRepositorySoftDeleteTests
{
    [Test]
    public async Task GetById_AfterSoftDelete_HidesRow_UnlessIncludeDeleted()
    {
        var repo = new InMemoryOrganizerRepository();
        var id = Guid.NewGuid();
        await repo.AddAsync(new Organizer { Id = id, Name = "Alive", CreatedAt = DateTime.UtcNow });

        await repo.DeleteAsync(id);

        Assert.That(await repo.GetByIdAsync(id), Is.Null);
        Assert.That(await repo.GetByIdForUpdateAsync(id), Is.Null);

        var included = await repo.GetByIdAsync(id, includeDeleted: true);
        Assert.That(included, Is.Not.Null);
        Assert.That(included!.Id, Is.EqualTo(id));
    }

    [Test]
    public async Task Update_ThenSoftDelete_PreservesAnonymizedName_ForIncludeDeleted()
    {
        var repo = new InMemoryOrganizerRepository();
        var id = Guid.NewGuid();
        await repo.AddAsync(new Organizer { Id = id, Name = "Alive", CreatedAt = DateTime.UtcNow });

        var organizer = (await repo.GetByIdAsync(id))!;
        organizer.Name = OrganizerDisplayNames.Deleted;
        organizer.LogoUrl = null;
        organizer.Links = null;
        await repo.UpdateAsync(organizer);
        await repo.DeleteAsync(id);

        Assert.That(await repo.GetByIdAsync(id), Is.Null);
        Assert.That(
            (await repo.GetByIdAsync(id, includeDeleted: true))!.Name,
            Is.EqualTo(OrganizerDisplayNames.Deleted));
    }

    [Test]
    public async Task Delete_IsIdempotent_AndForUpdateStaysNull()
    {
        var repo = new InMemoryOrganizerRepository();
        var id = Guid.NewGuid();
        await repo.AddAsync(new Organizer { Id = id, Name = "Alive", CreatedAt = DateTime.UtcNow });

        await repo.DeleteAsync(id);
        await repo.DeleteAsync(id);

        Assert.That(await repo.GetByIdAsync(id), Is.Null);
        Assert.That(await repo.GetByIdForUpdateAsync(id), Is.Null);
        Assert.That(await repo.GetByIdAsync(id, includeDeleted: true), Is.Not.Null);
    }
}
