using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryConsentEventRepository : IConsentEventRepository
{
    private readonly ConcurrentDictionary<Guid, ConsentEvent> _events = new();

    public Task<IReadOnlyList<ConsentEvent>> ListBySubjectAsync(
        Guid subjectId,
        CancellationToken cancellationToken = default)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        IEnumerable<ConsentEvent> source = tx is null
            ? _events.Values
            : VisibleEvents(tx);

        IReadOnlyList<ConsentEvent> list = source
            .Where(e => e.SubjectId == subjectId)
            .OrderBy(e => e.EventAt)
            .ToList();
        return Task.FromResult(list);
    }

    public Task<ConsentEvent?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            _events.TryGetValue(id, out var consentEvent);
            return Task.FromResult(consentEvent);
        }

        return Task.FromResult(GetVisible(tx, id));
    }

    public Task<bool> TryAddAsync(ConsentEvent consentEvent, CancellationToken cancellationToken = default)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            return Task.FromResult(_events.TryAdd(consentEvent.Id, consentEvent));
        }

        return Task.FromResult(TryStageAdd(tx, consentEvent));
    }

    public Task<bool> TryAddBatchAsync(
        IReadOnlyList<ConsentEvent> events,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(events);

        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            return TryAddBatchImmediateAsync(events);
        }

        var seen = new HashSet<Guid>();
        foreach (var consentEvent in events)
        {
            if (!seen.Add(consentEvent.Id) || GetVisible(tx, consentEvent.Id) is not null)
            {
                return Task.FromResult(false);
            }
        }

        foreach (var consentEvent in events)
        {
            StageAdd(tx, consentEvent);
        }

        return Task.FromResult(true);
    }

    public Task<bool> TryRemoveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            return Task.FromResult(_events.TryRemove(id, out _));
        }

        if (tx.ConsentAdds.Remove(id))
        {
            return Task.FromResult(true);
        }

        if (GetVisible(tx, id) is null)
        {
            return Task.FromResult(false);
        }

        tx.RegisterParticipant(this, undos => Apply(tx, undos));
        tx.ConsentRemoves.Add(id);
        return Task.FromResult(true);
    }

    private Task<bool> TryAddBatchImmediateAsync(IReadOnlyList<ConsentEvent> events)
    {
        var addedIds = new List<Guid>(events.Count);
        foreach (var consentEvent in events)
        {
            if (!_events.TryAdd(consentEvent.Id, consentEvent))
            {
                foreach (var id in addedIds)
                {
                    _events.TryRemove(id, out _);
                }

                return Task.FromResult(false);
            }

            addedIds.Add(consentEvent.Id);
        }

        return Task.FromResult(true);
    }

    private bool TryStageAdd(InMemoryLegalConsentTransaction tx, ConsentEvent consentEvent)
    {
        if (GetVisible(tx, consentEvent.Id) is not null)
        {
            return false;
        }

        StageAdd(tx, consentEvent);
        return true;
    }

    private void StageAdd(InMemoryLegalConsentTransaction tx, ConsentEvent consentEvent)
    {
        tx.RegisterParticipant(this, undos => Apply(tx, undos));
        tx.ConsentRemoves.Remove(consentEvent.Id);
        tx.ConsentAdds[consentEvent.Id] = consentEvent;
    }

    private ConsentEvent? GetVisible(InMemoryLegalConsentTransaction tx, Guid id)
    {
        if (tx.ConsentRemoves.Contains(id))
        {
            return null;
        }

        if (tx.ConsentAdds.TryGetValue(id, out var pending))
        {
            return pending;
        }

        _events.TryGetValue(id, out var consentEvent);
        return consentEvent;
    }

    private IEnumerable<ConsentEvent> VisibleEvents(InMemoryLegalConsentTransaction tx)
    {
        foreach (var consentEvent in _events.Values)
        {
            if (!tx.ConsentRemoves.Contains(consentEvent.Id) &&
                !tx.ConsentAdds.ContainsKey(consentEvent.Id))
            {
                yield return consentEvent;
            }
        }

        foreach (var consentEvent in tx.ConsentAdds.Values)
        {
            if (!tx.ConsentRemoves.Contains(consentEvent.Id))
            {
                yield return consentEvent;
            }
        }
    }

    private void Apply(InMemoryLegalConsentTransaction tx, ICollection<Action> undos)
    {
        foreach (var id in tx.ConsentRemoves)
        {
            if (_events.TryRemove(id, out var removed))
            {
                undos.Add(() => _events.TryAdd(id, removed));
            }
        }

        foreach (var (id, consentEvent) in tx.ConsentAdds)
        {
            if (!_events.TryAdd(id, consentEvent))
            {
                throw new InvalidOperationException($"Consent event {id} already exists.");
            }

            undos.Add(() => _events.TryRemove(id, out _));
        }
    }
}
