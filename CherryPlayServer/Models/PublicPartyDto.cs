using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record PublicPartyDto(
    string Id,
    string Name,
    ThemeId ThemeId,
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
