using System.Text.Json;

namespace CherryPlayServer.Core.Enums;

public static class ThemeIdExtensions
{
    /// <summary>
    /// Конвертирует строку в ThemeId enum
    /// </summary>
    public static ThemeId? ParseThemeId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        // Прямое сравнение для быстрой проверки
        return value.ToLowerInvariant() switch
        {
            "cyberpunk" => ThemeId.Cyberpunk,
            "sakura" => ThemeId.Sakura,
            "art-deco" => ThemeId.ArtDeco,
            _ => null
        };
    }

    /// <summary>
    /// Конвертирует ThemeId enum в строку для хранения в БД
    /// </summary>
    public static string ToStringValue(this ThemeId themeId)
    {
        return themeId switch
        {
            ThemeId.Cyberpunk => "cyberpunk",
            ThemeId.Sakura => "sakura",
            ThemeId.ArtDeco => "art-deco",
            _ => "cyberpunk" // default
        };
    }

    /// <summary>
    /// Пытается конвертировать строку в ThemeId, возвращает default если не удалось
    /// </summary>
    public static ThemeId ParseThemeIdOrDefault(string? value, ThemeId defaultValue = ThemeId.Cyberpunk)
    {
        return ParseThemeId(value) ?? defaultValue;
    }
}
