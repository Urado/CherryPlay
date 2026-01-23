namespace CherryPlayServer.Models;

public class PlaybackStateDto
{
    public string? CurrentTrackId { get; set; }
    public string Status { get; set; } = "idle"; // "idle", "playing", "paused", "ended"
    public double Position { get; set; }
    public double Duration { get; set; }
    public double Volume { get; set; } = 0.8;
    public string Mode { get; set; } = "preparation"; // "preparation" or "session"
    public List<string> PlayedTrackIds { get; set; } = new();
    public List<string> DisabledTrackIds { get; set; } = new();
    public List<string> DisabledGroupIds { get; set; } = new();
    public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;
}

