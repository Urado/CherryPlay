using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;

namespace CherryPlayServer.Tests;

public sealed class ThrowingPublicPartyQueryService : IPublicPartyQueryService
{
    public Task<PublicPartyDto?> GetPublicPartyAsync(string shortCode) =>
        throw new InvalidOperationException("Runtime smoke failure");

    public Task<PartyPlaylistDto?> GetPartyPlaylistByShortCodeAsync(string shortCode) =>
        throw new InvalidOperationException("Runtime smoke failure");

    public Task<List<PublicPartyListItemDto>> GetAllPublicPartiesAsync() =>
        throw new InvalidOperationException("Runtime smoke failure");

    public Task<PartyPlaylistDto?> GetFirstPartyPlaylistAsync() =>
        throw new InvalidOperationException("Runtime smoke failure");
}
