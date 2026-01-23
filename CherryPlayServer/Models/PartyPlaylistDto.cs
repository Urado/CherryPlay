namespace CherryPlayServer.Models;

public class PartyPlaylistDto
{
    public List<PlayerItem> Items { get; set; } = new();
    public int TotalDuration { get; set; }
    public int TotalTracks { get; set; }
}

