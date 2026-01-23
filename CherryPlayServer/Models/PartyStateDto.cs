namespace CherryPlayServer.Models;

public class PartyStateDto
{
    public string PartyId { get; set; } = string.Empty;
    public bool IsSessionActive { get; set; }
    public PlaybackStateDto? PlaybackState { get; set; }
    public PartyPlaylistDto Playlist { get; set; } = new();
}

