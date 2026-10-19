using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Core.Services;

public sealed class AdminPartyQueryService(
    IAdminPartyRepository repository,
    IOrganizerConnectionTracker connectionTracker) : IAdminPartyQueryService
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
        var result = await repository.GetPageAsync(
            organizerId,
            query?.Trim(),
            city?.Trim(),
            lifecycleState,
            isListedInCatalog,
            isDeleted,
            Math.Max(1, page),
            Math.Clamp(pageSize, 1, 100),
            cancellationToken);
        var items = result.Items
            .Select(item => item with { IsOrganizerConnected = connectionTracker.IsOrganizerConnected(item.Id) })
            .ToArray();
        return result with { Items = Array.AsReadOnly(items) };
    }

    public async Task<AdminPartyDetail?> GetByIdAsync(Guid partyId, CancellationToken cancellationToken = default)
    {
        var detail = await repository.GetByIdAsync(partyId, cancellationToken);
        return detail is null ? null : detail with { IsOrganizerConnected = connectionTracker.IsOrganizerConnected(partyId) };
    }
}
