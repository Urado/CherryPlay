using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IStreamingRepository
{
    Task<PlaybackState?> GetSessionStateAsync(Guid partyId);
    Task SetSessionStateAsync(Guid partyId, PlaybackState state);
    Task DeleteSessionStateAsync(Guid partyId);
    Task<Dictionary<Guid, PlaybackState>> GetAllSessionStatesAsync();
}
