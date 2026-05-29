using CherryPlayServer.Core.Enums;
using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IPartyService
{
    Task<PartyDto> CreatePartyAsync(CreatePartyDto dto);
    Task<PartyDto?> GetPartyAsync(Guid partyId);
    Task<PartyDto?> GetPartyByShortCodeAsync(string shortCode);
    Task<List<PartyDto>> GetAllPartiesAsync();
    Task<List<PartyDto>> GetPartiesByOrganizerAsync();
    Task UpdatePartyMetadataAsync(Guid partyId, UpdatePartyDto dto);
    Task UpdatePartyPlaylistAsync(Guid partyId, PartyPlaylistDto playlist);
    Task DeletePartyAsync(Guid partyId);
    Task<PartyDto> TransitionPartyLifecycleAsync(Guid partyId, PartyLifecycleState targetState);
}
