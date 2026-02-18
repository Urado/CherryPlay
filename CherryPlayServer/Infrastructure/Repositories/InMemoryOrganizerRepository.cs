using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryOrganizerRepository : IOrganizerRepository
{
    private readonly ConcurrentDictionary<Guid, Organizer> _organizers = new();

    public Task<Organizer?> GetByIdAsync(Guid id)
    {
        _organizers.TryGetValue(id, out var organizer);
        return Task.FromResult(organizer);
    }

    public Task<Organizer> AddAsync(Organizer organizer)
    {
        _organizers.TryAdd(organizer.Id, organizer);
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
        _organizers.TryRemove(id, out _);
        return Task.CompletedTask;
    }
}
