using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryOrganizerSessionRepository : IOrganizerSessionRepository
{
    private readonly ConcurrentDictionary<Guid, OrganizerSession> _sessions = new();

    public int CountByOrganizerId(Guid organizerId) =>
        VisibleSessions().Count(s => s.OrganizerId == organizerId);

    public Task<OrganizerSession?> GetByIdAsync(Guid sessionId)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is not null)
        {
            if (tx.SessionRemoves.Contains(sessionId))
            {
                return Task.FromResult<OrganizerSession?>(null);
            }

            if (tx.SessionAdds.TryGetValue(sessionId, out var pending))
            {
                return Task.FromResult<OrganizerSession?>(pending);
            }
        }

        _sessions.TryGetValue(sessionId, out var session);
        return Task.FromResult(session);
    }

    public Task<OrganizerSession> AddAsync(OrganizerSession session)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            _sessions.TryAdd(session.Id, session);
            return Task.FromResult(session);
        }

        tx.RegisterParticipant(this, undos => Apply(tx, undos));
        tx.SessionRemoves.Remove(session.Id);
        tx.SessionAdds[session.Id] = session;
        return Task.FromResult(session);
    }

    public Task RemoveAsync(Guid sessionId)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            _sessions.TryRemove(sessionId, out _);
            return Task.CompletedTask;
        }

        if (tx.SessionAdds.Remove(sessionId))
        {
            return Task.CompletedTask;
        }

        if (!_sessions.ContainsKey(sessionId) || tx.SessionRemoves.Contains(sessionId))
        {
            return Task.CompletedTask;
        }

        tx.RegisterParticipant(this, undos => Apply(tx, undos));
        tx.SessionRemoves.Add(sessionId);
        return Task.CompletedTask;
    }

    public Task RemoveAllByOrganizerIdAsync(Guid organizerId)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            foreach (var id in _sessions.Where(kv => kv.Value.OrganizerId == organizerId).Select(kv => kv.Key).ToList())
            {
                _sessions.TryRemove(id, out _);
            }

            return Task.CompletedTask;
        }

        foreach (var id in tx.SessionAdds
                     .Where(kv => kv.Value.OrganizerId == organizerId)
                     .Select(kv => kv.Key)
                     .ToList())
        {
            tx.SessionAdds.Remove(id);
        }

        var toRemove = _sessions
            .Where(kv => kv.Value.OrganizerId == organizerId && !tx.SessionRemoves.Contains(kv.Key))
            .Select(kv => kv.Key)
            .ToList();

        if (toRemove.Count == 0)
        {
            return Task.CompletedTask;
        }

        tx.RegisterParticipant(this, undos => Apply(tx, undos));
        foreach (var id in toRemove)
        {
            tx.SessionRemoves.Add(id);
        }

        return Task.CompletedTask;
    }

    private IEnumerable<OrganizerSession> VisibleSessions()
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        foreach (var session in _sessions.Values)
        {
            if (tx is not null && tx.SessionRemoves.Contains(session.Id))
            {
                continue;
            }

            yield return session;
        }

        if (tx is null)
        {
            yield break;
        }

        foreach (var session in tx.SessionAdds.Values)
        {
            yield return session;
        }
    }

    private void Apply(InMemoryLegalConsentTransaction tx, ICollection<Action> undos)
    {
        foreach (var id in tx.SessionRemoves)
        {
            if (_sessions.TryRemove(id, out var removed))
            {
                undos.Add(() => _sessions.TryAdd(id, removed));
            }
        }

        foreach (var (id, session) in tx.SessionAdds)
        {
            if (!_sessions.TryAdd(id, session))
            {
                throw new InvalidOperationException($"Organizer session {id} already exists.");
            }

            undos.Add(() => _sessions.TryRemove(id, out _));
        }
    }
}
