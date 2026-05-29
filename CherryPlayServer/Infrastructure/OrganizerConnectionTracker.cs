using System.Collections.Concurrent;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure;

public class OrganizerConnectionTracker : IOrganizerConnectionTracker
{
    private readonly ConcurrentDictionary<string, Guid> _connectionToParty = new();
    private readonly ConcurrentDictionary<Guid, string> _partyToConnection = new();
    private readonly ConcurrentDictionary<Guid, DateTime> _disconnectedAt = new();

    public void RegisterOrganizer(string connectionId, Guid partyId)
    {
        _connectionToParty[connectionId] = partyId;
        _partyToConnection[partyId] = connectionId;
        _disconnectedAt.TryRemove(partyId, out _);
    }

    public Guid? TryRemoveOrganizer(string connectionId)
    {
        if (!_connectionToParty.TryRemove(connectionId, out var partyId))
        {
            return null;
        }

        if (_partyToConnection.TryGetValue(partyId, out var activeConnectionId)
            && activeConnectionId == connectionId)
        {
            _partyToConnection.TryRemove(partyId, out _);
            _disconnectedAt[partyId] = DateTime.UtcNow;
        }

        return partyId;
    }

    public bool IsOrganizerConnected(Guid partyId)
    {
        return _partyToConnection.ContainsKey(partyId);
    }

    public bool TryGetOrganizerDisconnectedAt(Guid partyId, out DateTime disconnectedAt)
    {
        return _disconnectedAt.TryGetValue(partyId, out disconnectedAt);
    }
}
