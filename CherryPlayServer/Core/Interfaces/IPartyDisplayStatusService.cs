using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Interfaces;

public interface IPartyDisplayStatusService
{
    PartyDisplayStatus Compute(
        PartyLifecycleState lifecycle,
        PlaybackState? sessionState,
        Guid partyId,
        DateTime? utcNow = null);
}
