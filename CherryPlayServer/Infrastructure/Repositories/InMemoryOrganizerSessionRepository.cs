using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryOrganizerSessionRepository : IOrganizerSessionRepository
{
    private readonly ConcurrentDictionary<Guid, OrganizerSession> _sessions = new();

    public Task<OrganizerSession?> GetByIdAsync(Guid sessionId)
    {
        _sessions.TryGetValue(sessionId, out var session);
        return Task.FromResult(session);
    }

    public Task<OrganizerSession> AddAsync(OrganizerSession session)
    {
        _sessions.TryAdd(session.Id, session);
        return Task.FromResult(session);
    }

    public Task RemoveAsync(Guid sessionId)
    {
        _sessions.TryRemove(sessionId, out _);
        return Task.CompletedTask;
    }
}
