using CherryPlayServer.Core.Entities;
using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Mappings;

public static class PlaybackStateMapper
{
    public static PlaybackStateDto? ToDto(this PlaybackState? entity)
    {
        if (entity == null)
        {
            return null;
        }

        return new PlaybackStateDto
        {
            CurrentTrackId = entity.CurrentTrackId,
            Status = entity.Status,
            Position = entity.Position,
            Duration = entity.Duration,
            Volume = entity.Volume,
            Mode = entity.Mode,
            PlayedTrackIds = entity.PlayedTrackIds.ToList(),
            DisabledTrackIds = entity.DisabledTrackIds.ToList(),
            DisabledGroupIds = entity.DisabledGroupIds.ToList(),
            LastUpdatedAt = entity.LastUpdatedAt
        };
    }

    public static PlaybackState ToEntity(this PlaybackStateDto? dto)
    {
        if (dto == null)
        {
            throw new ArgumentNullException(nameof(dto));
        }

        return new PlaybackState
        {
            CurrentTrackId = dto.CurrentTrackId,
            Status = dto.Status,
            Position = dto.Position,
            Duration = dto.Duration,
            Volume = dto.Volume,
            Mode = dto.Mode,
            PlayedTrackIds = dto.PlayedTrackIds.ToList(),
            DisabledTrackIds = dto.DisabledTrackIds.ToList(),
            DisabledGroupIds = dto.DisabledGroupIds.ToList(),
            LastUpdatedAt = dto.LastUpdatedAt
        };
    }
}
