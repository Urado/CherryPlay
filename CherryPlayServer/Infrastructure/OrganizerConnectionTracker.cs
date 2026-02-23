using System.Collections.Concurrent;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure;

public class OrganizerConnectionTracker : IOrganizerConnectionTracker
{
    private readonly ConcurrentDictionary<string, Guid> _connectionToParty = new();

    public void RegisterOrganizer(string connectionId, Guid partyId)
    {
        _connectionToParty[connectionId] = partyId;
    }

    public Guid? TryRemoveOrganizer(string connectionId)
    {
        return _connectionToParty.TryRemove(connectionId, out var partyId) ? partyId : null;
    }
}
