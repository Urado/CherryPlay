using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryOrganizerRepository : IOrganizerRepository
{
    private readonly ConcurrentDictionary<Guid, Organizer> _organizers = new();

    public Task<Organizer?> GetByIdAsync(Guid id)
    {
        var tx = InMemoryLegalConsentUnitOfWork.Current;
        if (tx is null)
        {
            _organizers.TryGetValue(id, out var organizer);
            return Task.FromResult(organizer);
        }

        return Task.FromResult(GetVisible(tx, id));
    }

    public Task<Organizer> AddAsync(Organizer organizer)
    {
        var tx = InMemoryLegalConsentUnitOfWork.Current;
        if (tx is null)
        {
            _organizers.TryAdd(organizer.Id, organizer);
            return Task.FromResult(organizer);
        }

        if (GetVisible(tx, organizer.Id) is null)
        {
            tx.RegisterParticipant(this, undos => Apply(tx, undos));
            tx.OrganizerRemoves.Remove(organizer.Id);
            tx.OrganizerAdds[organizer.Id] = organizer;
        }

        return Task.FromResult(organizer);
    }

    public Task UpdateAsync(Organizer organizer)
    {
        organizer.UpdatedAt = DateTime.UtcNow;
        _organizers.AddOrUpdate(organizer.Id, organizer, (key, oldValue) => organizer);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Guid id)
    {
        var tx = InMemoryLegalConsentUnitOfWork.Current;
        if (tx is null)
        {
            _organizers.TryRemove(id, out _);
            return Task.CompletedTask;
        }

        if (tx.OrganizerAdds.Remove(id))
        {
            return Task.CompletedTask;
        }

        if (GetVisible(tx, id) is null)
        {
            return Task.CompletedTask;
        }

        tx.RegisterParticipant(this, undos => Apply(tx, undos));
        tx.OrganizerRemoves.Add(id);
        return Task.CompletedTask;
    }

    private Organizer? GetVisible(InMemoryLegalConsentTransaction tx, Guid id)
    {
        if (tx.OrganizerRemoves.Contains(id))
        {
            return null;
        }

        if (tx.OrganizerAdds.TryGetValue(id, out var pending))
        {
            return pending;
        }

        _organizers.TryGetValue(id, out var organizer);
        return organizer;
    }

    private void Apply(InMemoryLegalConsentTransaction tx, ICollection<Action> undos)
    {
        foreach (var id in tx.OrganizerRemoves)
        {
            if (_organizers.TryRemove(id, out var removed))
            {
                undos.Add(() => _organizers.TryAdd(id, removed));
            }
        }

        foreach (var (id, organizer) in tx.OrganizerAdds)
        {
            if (!_organizers.TryAdd(id, organizer))
            {
                throw new InvalidOperationException($"Organizer {id} already exists.");
            }

            undos.Add(() => _organizers.TryRemove(id, out _));
        }
    }
}
