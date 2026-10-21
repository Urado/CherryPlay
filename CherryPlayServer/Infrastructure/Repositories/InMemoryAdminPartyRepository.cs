using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Repositories;

public sealed class InMemoryAdminPartyRepository(
    InMemoryPartyRepository parties,
    IOrganizerRepository organizers,
    IStreamingRepository streamingRepository,
    IOrganizerConnectionTracker connectionTracker) : IAdminPartyRepository
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
        cancellationToken.ThrowIfCancellationRequested();
        var allParties = await parties.GetAllForAdminAsync();
        var filtered = allParties.AsEnumerable();
        if (organizerId.HasValue)
        {
            filtered = filtered.Where(item => item.OrganizerId == organizerId.Value);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            filtered = filtered.Where(item => item.Name.Contains(query.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(city))
        {
            filtered = filtered.Where(item => item.City?.Contains(city.Trim(), StringComparison.OrdinalIgnoreCase) == true);
        }

        if (lifecycleState.HasValue)
        {
            filtered = filtered.Where(item => item.PartyLifecycleState == lifecycleState.Value);
        }

        if (isListedInCatalog.HasValue)
        {
            filtered = filtered.Where(item => item.IsListedInCatalog == isListedInCatalog.Value);
        }

        if (isDeleted.HasValue)
        {
            filtered = filtered.Where(item => item.IsDeleted == isDeleted.Value);
        }

        var sorted = filtered.OrderBy(item => item.CreatedAt).ThenBy(item => item.Id).ToArray();
        var offset = (long)(page - 1) * pageSize;
        var pageItems = offset >= sorted.Length ? [] : sorted.Skip((int)offset).Take(pageSize).ToArray();
        var items = new List<AdminPartyListItem>(pageItems.Length);
        foreach (var party in pageItems)
        {
            var organizer = await organizers.GetByIdAsync(party.OrganizerId, includeDeleted: true);
            var activeOrganizer = await organizers.GetByIdAsync(party.OrganizerId);
            var session = await streamingRepository.GetSessionStateAsync(party.Id);
            items.Add(new AdminPartyListItem(
                party.Id,
                party.OrganizerId,
                organizer?.Name ?? "Deleted organizer",
                activeOrganizer is null,
                party.Name,
                party.Title,
                party.ShortCode,
                party.City,
                party.EventDateTime,
                party.PartyLifecycleState,
                party.IsListedInCatalog,
                party.IsDeleted,
                session?.IsActive ?? false,
                connectionTracker.IsOrganizerConnected(party.Id)));
        }

        return new AdminPartyPage(Array.AsReadOnly(items.ToArray()), sorted.Length, page, pageSize);
    }

    public async Task<AdminPartyDetail?> GetByIdAsync(Guid partyId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var party = await parties.GetByIdIncludingDeletedForAdminAsync(partyId);
        if (party is null)
        {
            return null;
        }

        var organizer = await organizers.GetByIdAsync(party.OrganizerId, includeDeleted: true);
        var activeOrganizer = await organizers.GetByIdAsync(party.OrganizerId);
        var session = await streamingRepository.GetSessionStateAsync(partyId);
        return new AdminPartyDetail(party, organizer?.Name ?? "Deleted organizer", activeOrganizer is null, session, connectionTracker.IsOrganizerConnected(partyId));
    }

    public async Task<Party?> GetMutablePartyAsync(Guid partyId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var party = await parties.GetByIdIncludingDeletedForAdminAsync(partyId);
        return party is null || party.IsDeleted ? null : party;
    }

    public async Task<bool> SetLifecycleStateAsync(Guid partyId, PartyLifecycleState state, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return await parties.SetLifecycleStateForAdminAsync(partyId, state);
    }

    public async Task<bool> SetCatalogVisibilityAsync(Guid partyId, bool isListedInCatalog, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return await parties.SetCatalogVisibilityForAdminAsync(partyId, isListedInCatalog);
    }
}
