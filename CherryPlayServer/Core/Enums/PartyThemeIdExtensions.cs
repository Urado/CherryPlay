using System.Text.Json;

namespace CherryPlayServer.Core.Enums;

public static class PartyThemeIdExtensions
{
    public static PartyThemeId? ParsePartyThemeId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return value.ToLowerInvariant() switch
        {
            "cyberpunk" => PartyThemeId.Cyberpunk,
            "sakura" => PartyThemeId.Sakura,
            "art-deco" => PartyThemeId.ArtDeco,
            "basic" => PartyThemeId.Basic,
            "spring-cross-step" => PartyThemeId.SpringCrossStep,
            _ => null
        };
    }

    public static string ToStringValue(this PartyThemeId partyThemeId)
    {
        return partyThemeId switch
        {
            PartyThemeId.Cyberpunk => "cyberpunk",
            PartyThemeId.Sakura => "sakura",
            PartyThemeId.ArtDeco => "art-deco",
            PartyThemeId.Basic => "basic",
            PartyThemeId.SpringCrossStep => "spring-cross-step",
            _ => "basic"
        };
    }

    public static PartyThemeId ParsePartyThemeIdOrDefault(string? value, PartyThemeId defaultValue = PartyThemeDefaults.Id)
    {
        return ParsePartyThemeId(value) ?? defaultValue;
    }
}
