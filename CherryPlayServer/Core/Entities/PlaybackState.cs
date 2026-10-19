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
    public bool IsActive { get; set; } = true;

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
            LastUpdatedAt = LastUpdatedAt,
            IsActive = IsActive
        };
    }

    public bool ResetForAdministration(DateTime utcNow)
    {
        var changed = IsActive
            || SessionStartedAt.HasValue
            || CurrentTrackId is not null
            || Status != PlaybackStatus.Idle
            || Position != 0
            || Duration != 0
            || Mode != PlaybackMode.Preparation
            || PlayedTrackIds.Count != 0
            || DisabledTrackIds.Count != 0
            || DisabledGroupIds.Count != 0;
        IsActive = false;
        SessionStartedAt = null;
        CurrentTrackId = null;
        Status = PlaybackStatus.Idle;
        Position = 0;
        Duration = 0;
        Mode = PlaybackMode.Preparation;
        PlayedTrackIds = [];
        DisabledTrackIds = [];
        DisabledGroupIds = [];
        LastUpdatedAt = utcNow;
        return changed;
    }
}
