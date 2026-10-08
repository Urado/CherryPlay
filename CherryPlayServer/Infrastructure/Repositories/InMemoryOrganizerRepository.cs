using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryOrganizerRepository : IOrganizerRepository
{
    private readonly ConcurrentDictionary<Guid, Organizer> _organizers = new();
    private readonly ConcurrentDictionary<Guid, byte> _softDeleted = new();

    public int Count => _organizers.Count(pair => !_softDeleted.ContainsKey(pair.Key));

    public Task<Organizer?> GetByIdAsync(Guid id, bool includeDeleted = false)
    {
        var organizer = Resolve(id);
        if (organizer is null)
        {
            return Task.FromResult<Organizer?>(null);
        }

        if (!includeDeleted && IsSoftDeleted(id))
        {
            return Task.FromResult<Organizer?>(null);
        }

        return Task.FromResult<Organizer?>(organizer);
    }

    public Task<Organizer?> GetByIdForUpdateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var organizer = Resolve(id);
        if (organizer is null || IsSoftDeleted(id))
        {
            return Task.FromResult<Organizer?>(null);
        }

        return Task.FromResult<Organizer?>(Clone(organizer));
    }

    public Task<Organizer> AddAsync(Organizer organizer)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            _softDeleted.TryRemove(organizer.Id, out _);
            _organizers.TryAdd(organizer.Id, organizer);
            return Task.FromResult(organizer);
        }

        if (Resolve(organizer.Id) is null)
        {
            tx.RegisterParticipant(this, undos => Apply(tx, undos));
            tx.OrganizerRemoves.Remove(organizer.Id);
            tx.OrganizerUpdates.Remove(organizer.Id);
            tx.OrganizerUpdatePrevious.Remove(organizer.Id);
            tx.OrganizerAdds[organizer.Id] = organizer;
        }

        return Task.FromResult(organizer);
    }

    public Task UpdateAsync(Organizer organizer)
    {
        organizer.UpdatedAt = DateTime.UtcNow;
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            _organizers.AddOrUpdate(organizer.Id, organizer, (_, _) => organizer);
            return Task.CompletedTask;
        }

        if (tx.OrganizerAdds.ContainsKey(organizer.Id))
        {
            tx.OrganizerAdds[organizer.Id] = organizer;
            return Task.CompletedTask;
        }

        if (ResolveStored(organizer.Id) is null || IsSoftDeleted(organizer.Id))
        {
            return Task.CompletedTask;
        }

        tx.RegisterParticipant(this, undos => Apply(tx, undos));
        if (!tx.OrganizerUpdatePrevious.ContainsKey(organizer.Id)
            && _organizers.TryGetValue(organizer.Id, out var previous))
        {
            tx.OrganizerUpdatePrevious[organizer.Id] = Clone(previous);
        }

        tx.OrganizerUpdates[organizer.Id] = Clone(organizer);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Guid id)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            if (!_organizers.ContainsKey(id) || _softDeleted.ContainsKey(id))
            {
                return Task.CompletedTask;
            }

            _softDeleted[id] = 0;
            return Task.CompletedTask;
        }

        if (tx.OrganizerAdds.Remove(id))
        {
            tx.OrganizerUpdates.Remove(id);
            tx.OrganizerUpdatePrevious.Remove(id);
            return Task.CompletedTask;
        }

        if (ResolveStored(id) is null || IsSoftDeleted(id))
        {
            return Task.CompletedTask;
        }

        tx.RegisterParticipant(this, undos => Apply(tx, undos));
        tx.OrganizerRemoves.Add(id);
        return Task.CompletedTask;
    }

    private bool IsSoftDeleted(Guid id)
    {
        if (_softDeleted.ContainsKey(id))
        {
            return true;
        }

        var tx = InMemoryUnitOfWorkScope.Current;
        return tx is not null && tx.OrganizerRemoves.Contains(id);
    }

    private Organizer? Resolve(Guid id)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is not null)
        {
            if (tx.OrganizerAdds.TryGetValue(id, out var pendingAdd))
            {
                return pendingAdd;
            }

            if (tx.OrganizerUpdates.TryGetValue(id, out var pendingUpdate))
            {
                return pendingUpdate;
            }
        }

        return ResolveStored(id);
    }

    private Organizer? ResolveStored(Guid id)
    {
        _organizers.TryGetValue(id, out var organizer);
        return organizer;
    }

    private void Apply(InMemoryLegalConsentTransaction tx, ICollection<Action> undos)
    {
        foreach (var (id, organizer) in tx.OrganizerUpdates)
        {
            if (!_organizers.ContainsKey(id))
            {
                continue;
            }

            var previous = tx.OrganizerUpdatePrevious.TryGetValue(id, out var snap)
                ? snap
                : Clone(_organizers[id]);
            _organizers[id] = organizer;
            undos.Add(() => _organizers[id] = previous);
        }

        foreach (var id in tx.OrganizerRemoves)
        {
            if (_softDeleted.TryAdd(id, 0))
            {
                undos.Add(() => _softDeleted.TryRemove(id, out _));
            }
        }

        foreach (var (id, organizer) in tx.OrganizerAdds)
        {
            _softDeleted.TryRemove(id, out _);
            if (!_organizers.TryAdd(id, organizer))
            {
                throw new InvalidOperationException($"Organizer {id} already exists.");
            }

            undos.Add(() => _organizers.TryRemove(id, out _));
        }
    }

    private static Organizer Clone(Organizer source) => new()
    {
        Id = source.Id,
        Name = source.Name,
        LogoUrl = source.LogoUrl,
        Links = source.Links is null ? null : new Dictionary<string, string>(source.Links),
        DefaultPartyThemeId = source.DefaultPartyThemeId,
        DefaultCustomizationSettings = source.DefaultCustomizationSettings is null
            ? null
            : new Dictionary<string, object>(source.DefaultCustomizationSettings),
        TimeZone = source.TimeZone,
        Role = source.Role,
        CreatedAt = source.CreatedAt,
        UpdatedAt = source.UpdatedAt,
    };
}
