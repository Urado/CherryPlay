namespace CherryPlayServer.Models;

public record PartyPlaylistDto(
    List<PlayerItem>? Items = null,
    int TotalDuration = 0,
    int TotalTracks = 0
)
{
    public List<PlayerItem> Items { get; init; } = Items ?? [];
}

