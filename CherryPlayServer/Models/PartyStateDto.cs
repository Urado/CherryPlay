namespace CherryPlayServer.Models;

public record PartyStateDto
{
    public string PartyId { get; init; }
    public bool IsSessionActive { get; init; }
    public PlaybackStateDto? PlaybackState { get; init; }
    public PartyPlaylistDto Playlist { get; init; }

    public PartyStateDto(
        string partyId,
        bool isSessionActive,
        PlaybackStateDto? playbackState = null,
        PartyPlaylistDto? playlist = null)
    {
        PartyId = partyId;
        IsSessionActive = isSessionActive;
        PlaybackState = playbackState;
        Playlist = playlist ?? new PartyPlaylistDto();
    }
}

