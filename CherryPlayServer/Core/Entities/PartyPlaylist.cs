using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Entities;

public class PartyPlaylist
{
    public List<PlayerItem> Items { get; set; } = [];
    public int TotalDuration { get; set; }
    public int TotalTracks { get; set; }
}
