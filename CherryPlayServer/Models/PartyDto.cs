using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record PartyDto(
    string Id,
    string Name,
    string? Title,
    string? Subtitle,
    string ShortCode,
    PartyThemeId PartyThemeId,
    string CreatedAt,
    bool HasActiveSession,
    string? EventDateTime = null,
    string? EventEndDateTime = null,
    bool IsListedInCatalog = false,
    Dictionary<string, object>? CustomizationSettings = null,
    string? Description = null,
    string? Place = null,
    string? City = null,
    string? Schedule = null,
    string? TimeZone = null,
    string? ShortDescription = null,
    string? ExternalLinkUrl = null,
    string? ExternalLinkText = null,
    IReadOnlyList<string>? DanceTags = null
);
