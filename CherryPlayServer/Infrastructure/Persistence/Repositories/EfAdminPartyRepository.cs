using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence.Mappings;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public sealed class EfAdminPartyRepository(AppDbContext db) : IAdminPartyRepository
{
    public async Task<AdminPartyPage> GetPageAsync(
        Guid? organizerId,
        string? query,
        string? city,
        PartyLifecycleState? lifecycleState,
        bool? isListedInCatalog,
        bool? isDeleted,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var parties = db.Parties.IgnoreQueryFilters().AsNoTracking();
        if (organizerId.HasValue)
        {
            parties = parties.Where(item => item.OrganizerId == organizerId.Value);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var search = query.Trim();
            parties = db.Database.IsRelational()
                ? parties.Where(item => EF.Functions.ILike(item.Name, $"%{search}%"))
                : parties.Where(item => item.Name.Contains(search, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(city))
        {
            var cityFilter = city.Trim();
            parties = db.Database.IsRelational()
                ? parties.Where(item => item.City != null && EF.Functions.ILike(item.City, $"%{cityFilter}%"))
                : parties.Where(item => item.City != null && item.City.Contains(cityFilter, StringComparison.OrdinalIgnoreCase));
        }

        if (lifecycleState.HasValue)
        {
            parties = parties.Where(item => item.PartyLifecycleState == lifecycleState.Value);
        }

        if (isListedInCatalog.HasValue)
        {
            parties = parties.Where(item => item.IsListedInCatalog == isListedInCatalog.Value);
        }

        if (isDeleted.HasValue)
        {
            parties = parties.Where(item => item.IsDeleted == isDeleted.Value);
        }

        var total = await parties.CountAsync(cancellationToken);
        var offset = (long)(page - 1) * pageSize;
        if (offset >= total)
        {
            return new AdminPartyPage(Array.Empty<AdminPartyListItem>(), total, page, pageSize);
        }
        var rows = await parties
            .OrderBy(item => item.CreatedAt)
            .ThenBy(item => item.Id)
            .Skip((int)offset)
            .Take(pageSize)
            .Select(item => new
            {
                Party = item,
                OrganizerName = item.Organizer.Name,
                IsOrganizerDeleted = item.Organizer.IsDeleted,
                HasActiveSession = item.SessionState != null && item.SessionState.IsActive
            })
            .ToListAsync(cancellationToken);
        var items = rows.Select(row => new AdminPartyListItem(
            row.Party.Id,
            row.Party.OrganizerId,
            row.OrganizerName,
            row.IsOrganizerDeleted,
            row.Party.Name,
            row.Party.Title,
            row.Party.ShortCode,
            row.Party.City,
            row.Party.EventDateTime,
            row.Party.PartyLifecycleState,
            row.Party.IsListedInCatalog,
            row.Party.IsDeleted,
            row.HasActiveSession,
            false)).ToArray();
        return new AdminPartyPage(Array.AsReadOnly(items), total, page, pageSize);
    }

    public async Task<AdminPartyDetail?> GetByIdAsync(Guid partyId, CancellationToken cancellationToken = default)
    {
        var entity = await db.Parties.IgnoreQueryFilters()
            .AsNoTracking()
            .Include(item => item.Organizer)
            .Include(item => item.Playlist)
            .Include(item => item.SessionState)
            .FirstOrDefaultAsync(item => item.Id == partyId, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        return new AdminPartyDetail(
            entity.ToDomain(),
            entity.Organizer.Name,
            entity.Organizer.IsDeleted,
            entity.SessionState?.ToDomain(),
            false);
    }

    public async Task<Party?> GetMutablePartyAsync(Guid partyId, CancellationToken cancellationToken = default)
    {
        var entity = await db.Parties.IgnoreQueryFilters()
            .AsNoTracking()
            .Include(item => item.Playlist)
            .FirstOrDefaultAsync(item => item.Id == partyId && !item.IsDeleted, cancellationToken);
        return entity?.ToDomain();
    }

    public async Task<bool> SetLifecycleStateAsync(Guid partyId, PartyLifecycleState state, CancellationToken cancellationToken = default)
    {
        var party = await db.Parties.IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.Id == partyId && !item.IsDeleted, cancellationToken);
        if (party is null)
        {
            return false;
        }

        party.PartyLifecycleState = state;
        party.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> SetCatalogVisibilityAsync(Guid partyId, bool isListedInCatalog, CancellationToken cancellationToken = default)
    {
        var party = await db.Parties.IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.Id == partyId && !item.IsDeleted, cancellationToken);
        if (party is null)
        {
            return false;
        }

        party.IsListedInCatalog = isListedInCatalog;
        party.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
