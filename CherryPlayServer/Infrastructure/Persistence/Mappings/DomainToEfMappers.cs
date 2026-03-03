using System.Text.Json;
using System.Text.Json.Serialization;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Infrastructure.Persistence.Entities;

namespace CherryPlayServer.Infrastructure.Persistence.Mappings;

public static class DomainToEfMappers
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    private static DateTime EnsureUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
            _ => value,
        };
    }

    private static DateTime? EnsureUtc(DateTime? value)
    {
        return value.HasValue ? EnsureUtc(value.Value) : null;
    }

    public static void ApplyTo(this Organizer domain, OrganizerEf ef)
    {
        ef.Name = domain.Name;
        ef.LogoUrl = domain.LogoUrl;
        ef.LinksJson = SerializeDictString(domain.Links);
        ef.DefaultPartyThemeId = domain.DefaultPartyThemeId?.ToStringValue();
        ef.DefaultCustomizationSettingsJson = SerializeDictObject(domain.DefaultCustomizationSettings);
        ef.TimeZone = domain.TimeZone;
        ef.UpdatedAt = DateTime.UtcNow;
    }

    public static OrganizerEf ToEf(this Organizer domain)
    {
        var ef = new OrganizerEf
        {
            Id = domain.Id,
            Name = domain.Name,
            LogoUrl = domain.LogoUrl,
            LinksJson = SerializeDictString(domain.Links),
            DefaultPartyThemeId = domain.DefaultPartyThemeId?.ToStringValue(),
            DefaultCustomizationSettingsJson = SerializeDictObject(domain.DefaultCustomizationSettings),
            TimeZone = domain.TimeZone,
            CreatedAt = EnsureUtc(domain.CreatedAt),
            UpdatedAt = EnsureUtc(domain.UpdatedAt ?? domain.CreatedAt),
            IsDeleted = false,
        };
        return ef;
    }

    public static void ApplyTo(this Party domain, PartyEf ef)
    {
        ef.Name = domain.Name;
        ef.Title = domain.Title;
        ef.Subtitle = domain.Subtitle;
        ef.Description = domain.Description;
        ef.Place = domain.Place;
        ef.City = domain.City;
        ef.EventDateTime = EnsureUtc(domain.EventDateTime);
        ef.EventEndDateTime = EnsureUtc(domain.EventEndDateTime);
        ef.Schedule = domain.Schedule;
        ef.TimeZone = domain.TimeZone;
        ef.PartyThemeId = domain.PartyThemeId.ToStringValue();
        ef.CustomizationSettingsJson = SerializeDictObject(domain.CustomizationSettings);
        ef.IsListedInCatalog = domain.IsListedInCatalog;
        ef.UpdatedAt = EnsureUtc(DateTime.UtcNow);
        ef.ShortDescription = domain.ShortDescription;
        ef.ExternalLinkUrl = domain.ExternalLinkUrl;
        ef.ExternalLinkText = domain.ExternalLinkText;
        ef.DanceTagsJson = SerializeStringList(domain.DanceTags);
    }

    public static PartyEf ToEf(this Party domain)
    {
        return new PartyEf
        {
            Id = domain.Id,
            OrganizerId = domain.OrganizerId,
            Name = domain.Name,
            Title = domain.Title,
            Subtitle = domain.Subtitle,
            ShortCode = domain.ShortCode,
            Description = domain.Description,
            Place = domain.Place,
            City = domain.City,
            EventDateTime = EnsureUtc(domain.EventDateTime),
            EventEndDateTime = EnsureUtc(domain.EventEndDateTime),
            Schedule = domain.Schedule,
            TimeZone = domain.TimeZone,
            PartyThemeId = domain.PartyThemeId.ToStringValue(),
            CustomizationSettingsJson = SerializeDictObject(domain.CustomizationSettings),
            IsListedInCatalog = domain.IsListedInCatalog,
            CreatedAt = EnsureUtc(domain.CreatedAt),
            UpdatedAt = null,
            IsDeleted = false,
            ShortDescription = domain.ShortDescription,
            ExternalLinkUrl = domain.ExternalLinkUrl,
            ExternalLinkText = domain.ExternalLinkText,
            DanceTagsJson = SerializeStringList(domain.DanceTags),
        };
    }

    public static PartyPlaylistEf ToEf(this PartyPlaylist domain, Guid partyId)
    {
        return new PartyPlaylistEf
        {
            PartyId = partyId,
            Items = domain.Items,
            TotalDuration = domain.TotalDuration,
            TotalTracks = domain.TotalTracks,
            UpdatedAt = EnsureUtc(DateTime.UtcNow),
        };
    }

    public static void ApplyTo(this PlaybackState domain, SessionStateEf ef)
    {
        ef.IsActive = domain.IsActive;
        ef.SessionStartedAt = EnsureUtc(domain.SessionStartedAt);
        ef.CurrentTrackId = domain.CurrentTrackId;
        ef.Status = domain.Status.ToString().ToLowerInvariant();
        ef.Position = domain.Position;
        ef.Duration = domain.Duration;
        ef.Volume = domain.Volume;
        ef.Mode = domain.Mode.ToString().ToLowerInvariant();
        ef.PlayedTrackIds = domain.PlayedTrackIds.ToList();
        ef.DisabledTrackIds = domain.DisabledTrackIds.ToList();
        ef.DisabledGroupIds = domain.DisabledGroupIds.ToList();
        ef.LastUpdatedAt = EnsureUtc(domain.LastUpdatedAt);
    }

    public static SessionStateEf ToEf(this PlaybackState domain, Guid partyId)
    {
        var ef = new SessionStateEf
        {
            PartyId = partyId,
            IsActive = domain.IsActive,
            SessionStartedAt = EnsureUtc(domain.SessionStartedAt),
            CurrentTrackId = domain.CurrentTrackId,
            Status = domain.Status.ToString().ToLowerInvariant(),
            Position = domain.Position,
            Duration = domain.Duration,
            Volume = domain.Volume,
            Mode = domain.Mode.ToString().ToLowerInvariant(),
            PlayedTrackIds = domain.PlayedTrackIds.ToList(),
            DisabledTrackIds = domain.DisabledTrackIds.ToList(),
            DisabledGroupIds = domain.DisabledGroupIds.ToList(),
            LastUpdatedAt = EnsureUtc(domain.LastUpdatedAt),
        };
        return ef;
    }

    public static EmailAccountEf ToEf(this EmailAccount domain)
    {
        return new EmailAccountEf
        {
            Id = domain.Id,
            OrganizerId = domain.OrganizerId,
            Email = domain.Email,
            PasswordHash = domain.PasswordHash,
            CreatedAt = domain.CreatedAt,
            LastUsedAt = domain.LastUsedAt,
        };
    }

    public static void ApplyTo(this EmailAccount domain, EmailAccountEf ef)
    {
        ef.Email = domain.Email;
        ef.PasswordHash = domain.PasswordHash;
        ef.LastUsedAt = domain.LastUsedAt;
    }

    public static OAuthAccountEf ToEf(this OAuthAccount domain)
    {
        return new OAuthAccountEf
        {
            Id = domain.Id,
            OrganizerId = domain.OrganizerId,
            Provider = domain.Provider.ToString().ToLowerInvariant(),
            ProviderUserId = domain.ProviderUserId,
            ProviderUserName = domain.ProviderUserName,
            ProviderUserAvatarUrl = domain.ProviderUserAvatarUrl,
            CreatedAt = domain.CreatedAt,
            LastUsedAt = domain.LastUsedAt,
        };
    }

    public static void ApplyTo(this OAuthAccount domain, OAuthAccountEf ef)
    {
        ef.ProviderUserName = domain.ProviderUserName;
        ef.ProviderUserAvatarUrl = domain.ProviderUserAvatarUrl;
        ef.LastUsedAt = domain.LastUsedAt;
    }

    public static OrganizerSessionEf ToEf(this OrganizerSession domain)
    {
        return new OrganizerSessionEf
        {
            Id = domain.Id,
            OrganizerId = domain.OrganizerId,
            CreatedAt = domain.CreatedAt,
        };
    }

    private static string? SerializeStringList(List<string>? list)
    {
        if (list == null || list.Count == 0) return null;
        return JsonSerializer.Serialize(list, JsonOptions);
    }

    private static string? SerializeDictString(Dictionary<string, string>? dict)
    {
        if (dict == null || dict.Count == 0) return null;
        return JsonSerializer.Serialize(dict, JsonOptions);
    }

    private static string? SerializeDictObject(Dictionary<string, object>? dict)
    {
        if (dict == null || dict.Count == 0) return null;
        var node = new Dictionary<string, JsonElement>();
        foreach (var kv in dict)
        {
            if (kv.Value == null) continue;
            node[kv.Key] = kv.Value switch
            {
                string s => JsonSerializer.SerializeToElement(s),
                int i => JsonSerializer.SerializeToElement(i),
                long l => JsonSerializer.SerializeToElement(l),
                double d => JsonSerializer.SerializeToElement(d),
                float f => JsonSerializer.SerializeToElement(f),
                bool b => JsonSerializer.SerializeToElement(b),
                _ => JsonSerializer.SerializeToElement(kv.Value.ToString() ?? string.Empty),
            };
        }
        return JsonSerializer.Serialize(node, JsonOptions);
    }
}
