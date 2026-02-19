using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Entities;

public class PlaybackState
{
    public string? CurrentTrackId { get; set; }
    public PlaybackStatus Status { get; set; } = PlaybackStatus.Idle;
    public double Position { get; set; }
    public double Duration { get; set; }
    public double Volume { get; set; } = 0.8;
    public PlaybackMode Mode { get; set; } = PlaybackMode.Preparation;
    public List<string> PlayedTrackIds { get; set; } = [];
    public List<string> DisabledTrackIds { get; set; } = [];
    public List<string> DisabledGroupIds { get; set; } = [];
    public DateTime? SessionStartedAt { get; set; }
    public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;

    public PlaybackState Clone()
    {
        return new PlaybackState
        {
            CurrentTrackId = CurrentTrackId,
            Status = Status,
            Position = Position,
            Duration = Duration,
            Volume = Volume,
            Mode = Mode,
            PlayedTrackIds = PlayedTrackIds.ToList(),
            DisabledTrackIds = DisabledTrackIds.ToList(),
            DisabledGroupIds = DisabledGroupIds.ToList(),
            SessionStartedAt = SessionStartedAt,
            LastUpdatedAt = LastUpdatedAt
        };
    }
}
