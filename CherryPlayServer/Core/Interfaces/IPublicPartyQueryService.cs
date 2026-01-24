using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IPublicPartyQueryService
{
    Task<PublicPartyDto?> GetPublicPartyAsync(string shortCode);
    Task<PartyPlaylistDto?> GetPartyPlaylistByShortCodeAsync(string shortCode);
    Task<List<PublicPartyListItemDto>> GetAllPublicPartiesAsync();
    Task<PartyPlaylistDto?> GetFirstPartyPlaylistAsync();
}
