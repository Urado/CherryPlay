using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Interfaces;

public interface IAdminPartyQueryService
{
    Task<AdminPartyPage> GetPageAsync(
        Guid? organizerId,
        string? query,
        string? city,
        PartyLifecycleState? lifecycleState,
        bool? isListedInCatalog,
        bool? isDeleted,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
    Task<AdminPartyDetail?> GetByIdAsync(Guid partyId, CancellationToken cancellationToken = default);
}
