using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record PlaybackStateDto
{
    public string? CurrentTrackId { get; init; }
    public PlaybackStatus Status { get; init; } = PlaybackStatus.Idle;
    public double Position { get; init; }
    public double Duration { get; init; }
    public double Volume { get; init; } = 0.8;
    public PlaybackMode Mode { get; init; } = PlaybackMode.Preparation;
    public List<string> PlayedTrackIds { get; init; } = [];
    public List<string> DisabledTrackIds { get; init; } = [];
    public List<string> DisabledGroupIds { get; init; } = [];
    public DateTime? SessionStartedAt { get; init; }
    public DateTime LastUpdatedAt { get; init; } = DateTime.UtcNow;
}
