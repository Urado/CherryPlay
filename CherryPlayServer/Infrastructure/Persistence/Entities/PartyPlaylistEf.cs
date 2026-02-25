using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class PartyPlaylistEf
{
    public Guid PartyId { get; set; }
    public List<PlayerItem> Items { get; set; } = [];
    public int TotalDuration { get; set; }
    public int TotalTracks { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public PartyEf Party { get; set; } = null!;
}
