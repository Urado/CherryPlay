using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record PublicPartyDto(
    string Id,
    string Name,
    string? Title,
    string? Subtitle,
    /// <summary>
    /// PartyTheme идентификатор (см. GLOSSARY.md)
    /// </summary>
    PartyThemeId PartyThemeId,
    bool HasActiveSession,
    bool IsListedInCatalog,
    Dictionary<string, object>? CustomizationSettings = null,
    string? SessionStartedAt = null,
    string? Description = null,
    string? Place = null,
    string? City = null,
    string? EventDateTime = null,
    string? Schedule = null,
    string? TimeZone = null
);
