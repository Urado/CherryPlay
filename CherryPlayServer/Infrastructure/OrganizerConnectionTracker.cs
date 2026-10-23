using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure;

public class OrganizerConnectionTracker : IOrganizerConnectionTracker
{
    private readonly object _gate = new();
    private readonly Dictionary<string, Guid> _connectionToParty = new(StringComparer.Ordinal);
    private readonly Dictionary<Guid, HashSet<string>> _partyToConnections = [];
    private readonly Dictionary<Guid, DateTime> _disconnectedAt = [];

    public void RegisterOrganizer(string connectionId, Guid partyId)
    {
        lock (_gate)
        {
            RemoveConnectionFromParty(connectionId);
            _connectionToParty[connectionId] = partyId;
            if (!_partyToConnections.TryGetValue(partyId, out var connections))
            {
                connections = new HashSet<string>(StringComparer.Ordinal);
                _partyToConnections[partyId] = connections;
            }
            connections.Add(connectionId);
            _disconnectedAt.Remove(partyId);
        }
    }

    public Guid? TryRemoveOrganizer(string connectionId) => TryRemoveOrganizerCore(connectionId, null);

    public Guid? TryRemoveOrganizer(string connectionId, Guid expectedPartyId) =>
        TryRemoveOrganizerCore(connectionId, expectedPartyId);

    private Guid? TryRemoveOrganizerCore(string connectionId, Guid? expectedPartyId)
    {
        lock (_gate)
        {
            if (!_connectionToParty.TryGetValue(connectionId, out var partyId)
                || expectedPartyId.HasValue && partyId != expectedPartyId.Value)
            {
                return null;
            }

            _connectionToParty.Remove(connectionId);

            if (!_partyToConnections.TryGetValue(partyId, out var connections))
            {
                return partyId;
            }

            connections.Remove(connectionId);
            if (connections.Count > 0)
            {
                return null;
            }

            _partyToConnections.Remove(partyId);
            _disconnectedAt[partyId] = DateTime.UtcNow;
            return partyId;
        }
    }

    private void RemoveConnectionFromParty(string connectionId)
    {
        if (!_connectionToParty.Remove(connectionId, out var oldPartyId))
        {
            return;
        }

        if (!_partyToConnections.TryGetValue(oldPartyId, out var connections))
        {
            return;
        }

        connections.Remove(connectionId);
        if (connections.Count == 0)
        {
            _partyToConnections.Remove(oldPartyId);
            _disconnectedAt[oldPartyId] = DateTime.UtcNow;
        }
    }

    public bool IsOrganizerConnected(Guid partyId)
    {
        lock (_gate)
        {
            return _partyToConnections.TryGetValue(partyId, out var connections) && connections.Count > 0;
        }
    }

    public Guid? GetPartyId(string connectionId)
    {
        lock (_gate)
        {
            return _connectionToParty.TryGetValue(connectionId, out var partyId) ? partyId : null;
        }
    }

    public bool TryGetOrganizerDisconnectedAt(Guid partyId, out DateTime disconnectedAt)
    {
        lock (_gate)
        {
            return _disconnectedAt.TryGetValue(partyId, out disconnectedAt);
        }
    }
}
