using CherryPlayServer.Core.Entities;
using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Mappings;

public static class PartyMapper
{
    public static PartyDto ToDto(this Party party, bool hasActiveSession)
    {
        return new PartyDto(
            Id: party.Id.ToString(),
            Name: party.Name,
            ShortCode: party.ShortCode,
            PartyThemeId: party.PartyThemeId,
            CreatedAt: party.CreatedAt.ToString("O"),
            HasActiveSession: hasActiveSession,
            EventDateTime: party.EventDateTime?.ToString("O"),
            IsListedInCatalog: party.IsListedInCatalog,
            Description: party.Description,
            Place: party.Place,
            City: party.City,
            Schedule: party.Schedule,
            TimeZone: party.TimeZone
        );
    }

    public static PublicPartyDto ToPublicDto(this Party party, bool hasActiveSession, DateTime? sessionStartedAt = null)
    {
        return new PublicPartyDto(
            Id: party.Id.ToString(),
            Name: party.Name,
            PartyThemeId: party.PartyThemeId,
            HasActiveSession: hasActiveSession,
            IsListedInCatalog: party.IsListedInCatalog,
            CustomizationSettings: party.CustomizationSettings,
            SessionStartedAt: sessionStartedAt?.ToString("O"),
            Description: party.Description,
            Place: party.Place,
            City: party.City,
            EventDateTime: party.EventDateTime?.ToString("O"),
            Schedule: party.Schedule,
            TimeZone: party.TimeZone
        );
    }
}
