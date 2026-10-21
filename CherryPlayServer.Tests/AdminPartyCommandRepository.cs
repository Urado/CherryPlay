using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Tests;

public sealed class AdminPartyCommandRepository(Party party) : IAdminPartyRepository
{
    public Party Party { get; } = party;
    public int LifecycleWrites { get; private set; }
    public int VisibilityWrites { get; private set; }

    public Task<AdminPartyPage> GetPageAsync(Guid? organizerId, string? query, string? city, PartyLifecycleState? lifecycleState, bool? isListedInCatalog, bool? isDeleted, int page, int pageSize, CancellationToken cancellationToken = default) =>
        throw new NotSupportedException();

    public Task<AdminPartyDetail?> GetByIdAsync(Guid partyId, CancellationToken cancellationToken = default) =>
        Task.FromResult(partyId == Party.Id ? new AdminPartyDetail(Party, "Organizer", false, null, false) : null);

    public Task<Party?> GetMutablePartyAsync(Guid partyId, CancellationToken cancellationToken = default) =>
        Task.FromResult(partyId == Party.Id && !Party.IsDeleted ? Party : null);

    public Task<bool> SetLifecycleStateAsync(Guid partyId, PartyLifecycleState state, CancellationToken cancellationToken = default)
    {
        LifecycleWrites++;
        Party.SetLifecycleForAdministrator(state);
        return Task.FromResult(true);
    }

    public Task<bool> SetCatalogVisibilityAsync(Guid partyId, bool isListedInCatalog, CancellationToken cancellationToken = default)
    {
        VisibilityWrites++;
        Party.SetCatalogVisibility(isListedInCatalog);
        return Task.FromResult(true);
    }
}
