using System.Text.Json;

namespace CherryPlayServer.Core.Enums;

/// <summary>
/// Расширения для работы с PartyThemeId enum
/// </summary>
public static class PartyThemeIdExtensions
{
    /// <summary>
    /// Конвертирует строку в PartyThemeId enum
    /// </summary>
    public static PartyThemeId? ParsePartyThemeId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        // Прямое сравнение для быстрой проверки
        return value.ToLowerInvariant() switch
        {
            "cyberpunk" => PartyThemeId.Cyberpunk,
            "sakura" => PartyThemeId.Sakura,
            "art-deco" => PartyThemeId.ArtDeco,
            "basic" => PartyThemeId.Basic,
            _ => null
        };
    }

    /// <summary>
    /// Конвертирует PartyThemeId enum в строку для хранения в БД
    /// </summary>
    public static string ToStringValue(this PartyThemeId partyThemeId)
    {
        return partyThemeId switch
        {
            PartyThemeId.Cyberpunk => "cyberpunk",
            PartyThemeId.Sakura => "sakura",
            PartyThemeId.ArtDeco => "art-deco",
            PartyThemeId.Basic => "basic",
            _ => "cyberpunk" // default
        };
    }

    /// <summary>
    /// Пытается конвертировать строку в PartyThemeId, возвращает default если не удалось
    /// </summary>
    public static PartyThemeId ParsePartyThemeIdOrDefault(string? value, PartyThemeId defaultValue = PartyThemeId.Cyberpunk)
    {
        return ParsePartyThemeId(value) ?? defaultValue;
    }
}
