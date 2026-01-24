using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IPartyService
{
    Task<PartyDto> CreatePartyAsync(CreatePartyDto dto);
    Task<PartyDto?> GetPartyAsync(Guid partyId);
    Task<PartyDto?> GetPartyByShortCodeAsync(string shortCode);
    Task<List<PartyDto>> GetAllPartiesAsync();
    Task UpdatePartyPlaylistAsync(Guid partyId, PartyPlaylistDto playlist);
}
