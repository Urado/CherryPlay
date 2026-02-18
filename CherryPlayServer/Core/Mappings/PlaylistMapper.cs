using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Models;
using PlayerItemEntity = CherryPlayServer.Core.Entities.PlayerItem;
using PlayerItemDto = CherryPlayServer.Models.PlayerItem;

namespace CherryPlayServer.Core.Mappings;

public static class PlaylistMapper
{
    public static PartyPlaylistDto ToDto(this PartyPlaylist? entity)
    {
        if (entity == null)
        {
            return new PartyPlaylistDto(
                Items: [],
                TotalDuration: 0,
                TotalTracks: 0
            );
        }

        return new PartyPlaylistDto(
            Items: entity.Items?.Select(ToDto).ToList() ?? [],
            TotalDuration: entity.TotalDuration,
            TotalTracks: entity.TotalTracks
        );
    }

    public static PartyPlaylist ToEntity(this PartyPlaylistDto? dto)
    {
        if (dto == null)
        {
            return new PartyPlaylist();
        }

        return new PartyPlaylist
        {
            Items = dto.Items?.Select(ToEntity).ToList() ?? [],
            TotalDuration = dto.TotalDuration,
            TotalTracks = dto.TotalTracks
        };
    }

    public static PlayerItemDto ToDto(this PlayerItemEntity entity)
    {
        if (entity == null)
        {
            throw new ArgumentNullException(nameof(entity));
        }

        return new PlayerItemDto(
            Id: entity.Id,
            Type: entity.Type.ToStringValue(),
            Name: entity.Name,
            DisplayOrder: entity.DisplayOrder,
            Level: entity.Level,
            Duration: entity.Duration,
            Items: entity.Items?.Select(ToDto).ToList()
        );
    }

    public static PlayerItemEntity ToEntity(this PlayerItemDto? dto)
    {
        if (dto == null)
        {
            throw new ArgumentNullException(nameof(dto));
        }

        return new Core.Entities.PlayerItem
        {
            Id = dto.Id,
            Type = ParsePlayerItemType(dto.Type),
            Name = dto.Name,
            DisplayOrder = dto.DisplayOrder,
            Level = dto.Level,
            Duration = dto.Duration,
            Items = dto.Items?.Select(ToEntity).ToList()
        };
    }

    private static string ToStringValue(this PlayerItemType type)
    {
        return type switch
        {
            PlayerItemType.Track => "track",
            PlayerItemType.Group => "group",
            _ => "track"
        };
    }

    private static PlayerItemType ParsePlayerItemType(string type)
    {
        return type.ToLowerInvariant() switch
        {
            "track" => PlayerItemType.Track,
            "group" => PlayerItemType.Group,
            _ => PlayerItemType.Track
        };
    }
}
