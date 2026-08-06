using System.Text.Json;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Infrastructure.Persistence.Mappings;

public static class EfToDomainMappers
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public static Organizer ToDomain(this OrganizerEf ef)
    {
        return new Organizer
        {
            Id = ef.Id,
            Name = ef.Name,
            LogoUrl = ef.LogoUrl,
            Links = DeserializeDictString(ef.LinksJson),
            DefaultPartyThemeId = PartyThemeIdExtensions.ParsePartyThemeId(ef.DefaultPartyThemeId),
            DefaultCustomizationSettings = DeserializeDictObject(ef.DefaultCustomizationSettingsJson),
            TimeZone = ef.TimeZone,
            Role = ef.Role == "admin" ? OrganizerRole.Admin : OrganizerRole.Organizer,
            CreatedAt = ef.CreatedAt,
            UpdatedAt = ef.UpdatedAt,
        };
    }

    public static Party ToDomain(this PartyEf ef, ILogger? logger = null)
    {
        var party = new Party
        {
            Id = ef.Id,
            OrganizerId = ef.OrganizerId,
            Name = ef.Name,
            Title = ef.Title,
            Subtitle = ef.Subtitle,
            ShortCode = ef.ShortCode,
            Description = ef.Description,
            Place = ef.Place,
            City = ef.City,
            EventDateTime = ef.EventDateTime,
            EventEndDateTime = ef.EventEndDateTime,
            Schedule = ef.Schedule,
            TimeZone = ef.TimeZone,
            PartyThemeId = PartyThemeIdExtensions.ParsePartyThemeIdOrDefault(ef.PartyThemeId),
            CustomizationSettings = DeserializeDictObject(ef.CustomizationSettingsJson),
            IsListedInCatalog = ef.IsListedInCatalog,
            CreatedAt = ef.CreatedAt,
            Playlist = new PartyPlaylist(),
            ShortDescription = ef.ShortDescription,
            ExternalLinkUrl = ef.ExternalLinkUrl,
            ExternalLinkText = ef.ExternalLinkText,
            DanceTags = DeserializeStringList(ef.DanceTagsJson, logger) ?? [],
            PartyLifecycleState = ef.PartyLifecycleState,
        };
        if (ef.Playlist != null)
        {
            party.Playlist = new PartyPlaylist
            {
                Items = ef.Playlist.Items,
                TotalDuration = ef.Playlist.TotalDuration,
                TotalTracks = ef.Playlist.TotalTracks,
            };
        }
        return party;
    }

    public static PlaybackState ToDomain(this SessionStateEf ef)
    {
        return new PlaybackState
        {
            CurrentTrackId = ef.CurrentTrackId,
            Status = ParsePlaybackStatus(ef.Status),
            Position = ef.Position,
            Duration = ef.Duration,
            Volume = ef.Volume,
            Mode = ParsePlaybackMode(ef.Mode),
            PlayedTrackIds = ef.PlayedTrackIds.ToList(),
            DisabledTrackIds = ef.DisabledTrackIds.ToList(),
            DisabledGroupIds = ef.DisabledGroupIds.ToList(),
            SessionStartedAt = ef.SessionStartedAt,
            LastUpdatedAt = ef.LastUpdatedAt,
            IsActive = ef.IsActive,
        };
    }

    public static EmailAccount ToDomain(this EmailAccountEf ef)
    {
        return new EmailAccount
        {
            Id = ef.Id,
            OrganizerId = ef.OrganizerId,
            Email = ef.Email,
            PasswordHash = ef.PasswordHash,
            CreatedAt = ef.CreatedAt,
            LastUsedAt = ef.LastUsedAt,
        };
    }

    public static OAuthAccount ToDomain(this OAuthAccountEf ef)
    {
        return new OAuthAccount
        {
            Id = ef.Id,
            OrganizerId = ef.OrganizerId,
            Provider = ParseOAuthProvider(ef.Provider),
            ProviderUserId = ef.ProviderUserId,
            ProviderUserName = ef.ProviderUserName,
            ProviderUserAvatarUrl = ef.ProviderUserAvatarUrl,
            CreatedAt = ef.CreatedAt,
            LastUsedAt = ef.LastUsedAt,
        };
    }

    public static OrganizerSession ToDomain(this OrganizerSessionEf ef)
    {
        return new OrganizerSession
        {
            Id = ef.Id,
            OrganizerId = ef.OrganizerId,
            CreatedAt = ef.CreatedAt,
        };
    }

    public static PasswordResetToken ToDomain(this PasswordResetTokenEf ef)
    {
        return new PasswordResetToken
        {
            Id = ef.Id,
            EmailAccountId = ef.EmailAccountId,
            TokenHash = ef.TokenHash,
            ExpiresAt = ef.ExpiresAt,
            UsedAt = ef.UsedAt,
            CreatedAt = ef.CreatedAt,
        };
    }

    private static List<string>? DeserializeStringList(string? json, ILogger? logger = null)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOptions);
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "Failed to deserialize string list from JSON");
            return null;
        }
    }

    private static Dictionary<string, string>? DeserializeDictString(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(json, JsonOptions);
        }
        catch
        {
            return null;
        }
    }

    private static Dictionary<string, object>? DeserializeDictObject(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json, JsonOptions);
            if (dict == null) return null;
            var result = new Dictionary<string, object>();
            foreach (var kv in dict)
            {
                var value = JsonElementToObject(kv.Value);
                if (value is null)
                {
                    continue;
                }

                result[kv.Key] = value;
            }
            return result;
        }
        catch
        {
            return null;
        }
    }

    private static object? JsonElementToObject(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Object => element
                .EnumerateObject()
                .ToDictionary(
                    property => property.Name,
                    property => JsonElementToObject(property.Value)),
            JsonValueKind.Array => element
                .EnumerateArray()
                .Select(JsonElementToObject)
                .ToList(),
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt64(out var longValue)
                ? longValue
                : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            _ => element.GetRawText(),
        };
    }

    private static PlaybackStatus ParsePlaybackStatus(string? value)
    {
        return value?.ToLowerInvariant() switch
        {
            "idle" => PlaybackStatus.Idle,
            "playing" => PlaybackStatus.Playing,
            "paused" => PlaybackStatus.Paused,
            "ended" => PlaybackStatus.Ended,
            _ => PlaybackStatus.Idle,
        };
    }

    private static PlaybackMode ParsePlaybackMode(string? value)
    {
        return value?.ToLowerInvariant() switch
        {
            "preparation" => PlaybackMode.Preparation,
            "session" => PlaybackMode.Session,
            _ => PlaybackMode.Preparation,
        };
    }

    private static OAuthProvider ParseOAuthProvider(string? value)
    {
        return value?.ToLowerInvariant() switch
        {
            "telegram" => OAuthProvider.Telegram,
            "vk" => OAuthProvider.Vk,
            "mailru" => OAuthProvider.MailRu,
            _ => throw new ArgumentOutOfRangeException(nameof(value), value, "Unknown OAuth provider"),
        };
    }
}
