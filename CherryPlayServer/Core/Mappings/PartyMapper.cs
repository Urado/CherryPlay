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
            ThemeId: party.ThemeId,
            CreatedAt: party.CreatedAt.ToString("O"),
            HasActiveSession: hasActiveSession,
            EventDateTime: party.EventDateTime?.ToString("O")
        );
    }

    public static PublicPartyDto ToPublicDto(this Party party, bool hasActiveSession)
    {
        return new PublicPartyDto(
            Id: party.Id.ToString(),
            Name: party.Name,
            ThemeId: party.ThemeId,
            HasActiveSession: hasActiveSession,
            CustomizationSettings: party.CustomizationSettings,
            SessionStartedAt: null
        );
    }
}
