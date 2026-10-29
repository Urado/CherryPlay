using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Interfaces;

public interface IAdminPartyCommandService
{
    Task<AdminPartyCommandResult> SetLifecycleStateAsync(Guid partyId, PartyLifecycleState state, CancellationToken cancellationToken = default);
    Task<AdminPartyCommandResult> SetCatalogVisibilityAsync(Guid partyId, bool isListedInCatalog, CancellationToken cancellationToken = default);
    Task<AdminPartyCommandResult> ResetSessionAsync(Guid partyId, CancellationToken cancellationToken = default);
}
