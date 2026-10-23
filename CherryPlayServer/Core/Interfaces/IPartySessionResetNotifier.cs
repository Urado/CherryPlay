using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Interfaces;

public interface IPartySessionResetNotifier
{
    Task NotifySessionResetAsync(Guid partyId, PartyLifecycleState lifecycleState, PlaybackState state);
}
