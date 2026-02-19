using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record OrganizerDto(
    string Id,
    string Name,
    string? LogoUrl,
    Dictionary<string, string>? Links,
    ThemeId? DefaultThemeId,
    Dictionary<string, object>? DefaultCustomizationSettings,
    string? TimeZone,
    string CreatedAt,
    string? UpdatedAt
);
