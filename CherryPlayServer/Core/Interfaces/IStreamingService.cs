using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IStreamingService
{
    Task<PartyStateDto?> GetPartyStateAsync(string shortCode);
    Task StartSessionAsync(Guid partyId);
    Task EndSessionAsync(Guid partyId);
    Task ResetPlaybackStateAsync(Guid partyId);
    Task UpdatePlaybackPositionAsync(Guid partyId, string trackId, double position);
    Task UpdateFullStateAsync(Guid partyId, PlaybackStateDto state);
}
