namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class SessionStateEf
{
    public Guid PartyId { get; set; }
    public bool IsActive { get; set; }
    public DateTime? SessionStartedAt { get; set; }
    public string? CurrentTrackId { get; set; }
    public string Status { get; set; } = "idle";
    public double Position { get; set; }
    public double Duration { get; set; }
    public double Volume { get; set; } = 0.8;
    public string Mode { get; set; } = "preparation";
    public List<string> PlayedTrackIds { get; set; } = [];
    public List<string> DisabledTrackIds { get; set; } = [];
    public List<string> DisabledGroupIds { get; set; } = [];
    public DateTime LastUpdatedAt { get; set; }

    public PartyEf Party { get; set; } = null!;
}
