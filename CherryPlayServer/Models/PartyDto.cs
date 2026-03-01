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
    bool IsListedInCatalog = false,
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
