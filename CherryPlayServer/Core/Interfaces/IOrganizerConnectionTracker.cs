namespace CherryPlayServer.Core.Interfaces;

/// <summary>
/// Tracks which SignalR connection is the organizer for which party.
/// Used to notify viewers when the organizer disconnects (e.g. app closed).
/// </summary>
public interface IOrganizerConnectionTracker
{
    void RegisterOrganizer(string connectionId, Guid partyId);

    Guid? TryRemoveOrganizer(string connectionId);

    bool IsOrganizerConnected(Guid partyId);

    bool TryGetOrganizerDisconnectedAt(Guid partyId, out DateTime disconnectedAt);
}
