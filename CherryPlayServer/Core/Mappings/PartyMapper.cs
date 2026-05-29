using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Mappings;

public static class PartyMapper
{
    public static PartyDto ToDto(this Party party, bool hasActiveSession)
    {
        return new PartyDto(
            Id: party.Id.ToString(),
            Name: party.Name,
            Title: party.Title,
            Subtitle: party.Subtitle,
            ShortCode: party.ShortCode,
            PartyThemeId: party.PartyThemeId,
            CreatedAt: party.CreatedAt.ToString("O"),
            HasActiveSession: hasActiveSession,
            EventDateTime: party.EventDateTime?.ToString("O"),
            EventEndDateTime: party.EventEndDateTime?.ToString("O"),
            PartyLifecycleState: party.PartyLifecycleState,
            IsListedInCatalog: party.IsListedInCatalog,
            CustomizationSettings: party.CustomizationSettings,
            Description: party.Description,
            Place: party.Place,
            City: party.City,
            Schedule: party.Schedule,
            TimeZone: party.TimeZone,
            ShortDescription: party.ShortDescription,
            ExternalLinkUrl: party.ExternalLinkUrl,
            ExternalLinkText: party.ExternalLinkText,
            DanceTags: party.DanceTags.Count > 0 ? party.DanceTags : null
        );
    }

    public static PublicPartyDto ToPublicDto(
        this Party party,
        bool hasActiveSession,
        PartyDisplayStatus partyDisplayStatus,
        DateTime? sessionStartedAt = null)
    {
        return new PublicPartyDto(
            Id: party.Id.ToString(),
            Name: party.Name,
            Title: party.Title,
            Subtitle: party.Subtitle,
            PartyThemeId: party.PartyThemeId,
            HasActiveSession: hasActiveSession,
            IsListedInCatalog: party.IsListedInCatalog,
            PartyLifecycleState: party.PartyLifecycleState,
            PartyDisplayStatus: partyDisplayStatus,
            CustomizationSettings: party.CustomizationSettings,
            SessionStartedAt: sessionStartedAt?.ToString("O"),
            Description: party.Description,
            Place: party.Place,
            City: party.City,
            EventDateTime: party.EventDateTime?.ToString("O"),
            EventEndDateTime: party.EventEndDateTime?.ToString("O"),
            Schedule: party.Schedule,
            TimeZone: party.TimeZone,
            ShortDescription: party.ShortDescription,
            ExternalLinkUrl: party.ExternalLinkUrl,
            ExternalLinkText: party.ExternalLinkText,
            DanceTags: party.DanceTags.Count > 0 ? party.DanceTags : null
        );
    }
}
