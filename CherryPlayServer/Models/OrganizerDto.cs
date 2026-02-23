using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record OrganizerDto(
    string Id,
    string Name,
    string? LogoUrl,
    Dictionary<string, string>? Links,
    /// <summary>
    /// PartyTheme по умолчанию (см. GLOSSARY.md)
    /// </summary>
    PartyThemeId? DefaultPartyThemeId,
    Dictionary<string, object>? DefaultCustomizationSettings,
    string? TimeZone,
    string CreatedAt,
    string? UpdatedAt
);
