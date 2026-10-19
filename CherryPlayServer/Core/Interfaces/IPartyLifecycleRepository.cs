using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Interfaces;

public interface IPartyLifecycleRepository
{
    Task<bool> UpdateLifecycleStateAsync(Guid partyId, PartyLifecycleState state, CancellationToken cancellationToken = default);
}
