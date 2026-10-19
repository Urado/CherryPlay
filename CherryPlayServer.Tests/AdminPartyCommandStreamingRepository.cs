using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Tests;

public sealed class AdminPartyCommandStreamingRepository : IStreamingRepository
{
    public PlaybackState? Session { get; set; }
    public int Writes { get; private set; }

    public Task<PlaybackState?> GetSessionStateAsync(Guid partyId) => Task.FromResult(Session);

    public Task SetSessionStateAsync(Guid partyId, PlaybackState state)
    {
        Writes++;
        Session = state;
        return Task.CompletedTask;
    }

    public Task DeleteSessionStateAsync(Guid partyId)
    {
        Session = null;
        return Task.CompletedTask;
    }

    public Task<Dictionary<Guid, PlaybackState>> GetAllSessionStatesAsync() =>
        Task.FromResult(new Dictionary<Guid, PlaybackState>());
}
