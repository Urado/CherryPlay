using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record PublicPartyDto(
    string Id,
    string Name,
    ThemeId ThemeId,
    bool HasActiveSession,
    Dictionary<string, object>? CustomizationSettings = null,
    string? SessionStartedAt = null
);
