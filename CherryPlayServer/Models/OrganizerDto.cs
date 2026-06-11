using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record OrganizerDto(
    string Id,
    string Name,
    string? LogoUrl,
    Dictionary<string, string>? Links,
    PartyThemeId? DefaultPartyThemeId,
    Dictionary<string, object>? DefaultCustomizationSettings,
    string? TimeZone,
    string Role,
    string CreatedAt,
    string? UpdatedAt
);
