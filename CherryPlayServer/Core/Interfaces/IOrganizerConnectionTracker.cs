namespace CherryPlayServer.Core.Interfaces;

public interface IOrganizerConnectionTracker
{
    Guid? GetPartyId(string connectionId) => null;

    void RegisterOrganizer(string connectionId, Guid partyId);

    Guid? TryRemoveOrganizer(string connectionId);

    Guid? TryRemoveOrganizer(string connectionId, Guid expectedPartyId) =>
        GetPartyId(connectionId) == expectedPartyId ? TryRemoveOrganizer(connectionId) : null;

    bool IsOrganizerConnected(Guid partyId);

    bool TryGetOrganizerDisconnectedAt(Guid partyId, out DateTime disconnectedAt);
}
