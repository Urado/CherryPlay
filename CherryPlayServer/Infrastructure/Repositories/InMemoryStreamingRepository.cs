using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryStreamingRepository : IStreamingRepository
{
    private readonly ConcurrentDictionary<Guid, PlaybackState> _sessions = new();

    public Task<PlaybackState?> GetSessionStateAsync(Guid partyId)
    {
        _sessions.TryGetValue(partyId, out var state);
        // Return a clone to prevent external mutations
        return Task.FromResult(state?.Clone());
    }

    public Task SetSessionStateAsync(Guid partyId, PlaybackState state)
    {
        // Store a clone to prevent external mutations
        _sessions.AddOrUpdate(partyId, state.Clone(), (key, oldValue) => state.Clone());
        return Task.CompletedTask;
    }

    public Task DeleteSessionStateAsync(Guid partyId)
    {
        _sessions.TryRemove(partyId, out _);
        return Task.CompletedTask;
    }

    public Task<Dictionary<Guid, PlaybackState>> GetAllSessionStatesAsync()
    {
        var result = _sessions.ToDictionary(kvp => kvp.Key, kvp => kvp.Value.Clone());
        return Task.FromResult(result);
    }
}
