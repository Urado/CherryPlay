using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record PartyStateDto
{
    public string PartyId { get; init; }
    public bool IsSessionActive { get; init; }
    public PartyDisplayStatus PartyDisplayStatus { get; init; }
    public PlaybackStateDto? PlaybackState { get; init; }
    public PartyPlaylistDto Playlist { get; init; }
    public IReadOnlyList<string> ServerTrackIds { get; init; }

    public PartyStateDto(
        string partyId,
        bool isSessionActive,
        PartyDisplayStatus partyDisplayStatus,
        PlaybackStateDto? playbackState = null,
        PartyPlaylistDto? playlist = null,
        IReadOnlyList<string>? serverTrackIds = null)
    {
        PartyId = partyId;
        IsSessionActive = isSessionActive;
        PartyDisplayStatus = partyDisplayStatus;
        PlaybackState = playbackState;
        Playlist = playlist ?? new PartyPlaylistDto();
        ServerTrackIds = serverTrackIds ?? Array.Empty<string>();
    }
}

