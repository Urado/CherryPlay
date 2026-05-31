using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Tests;

internal sealed class FakeOrganizerTracker : IOrganizerConnectionTracker
{
    public HashSet<Guid> ConnectedPartyIds { get; } = [];
    public Dictionary<Guid, DateTime> DisconnectedAt { get; } = [];

    public void RegisterOrganizer(string connectionId, Guid partyId) =>
        ConnectedPartyIds.Add(partyId);

    public Guid? TryRemoveOrganizer(string connectionId) => null;

    public bool IsOrganizerConnected(Guid partyId) => ConnectedPartyIds.Contains(partyId);

    public bool TryGetOrganizerDisconnectedAt(Guid partyId, out DateTime disconnectedAt) =>
        DisconnectedAt.TryGetValue(partyId, out disconnectedAt);
}

internal sealed class StubPartyDisplayStatusService(PartyDisplayStatus result) : IPartyDisplayStatusService
{
    public PartyDisplayStatus Compute(
        PartyLifecycleState lifecycle,
        PlaybackState? sessionState,
        Guid partyId,
        DateTime? utcNow = null) => result;
}
