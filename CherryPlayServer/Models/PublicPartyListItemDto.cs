using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record PublicPartyListItemDto(
    string Id,
    string Name,
    string? Title,
    string? Subtitle,
    string ShortCode,
    PartyThemeId PartyThemeId,
    bool HasActiveSession,
    string CreatedAt,
    int TotalTracks,
    int TotalDuration,
    string? EventDateTime = null,
    string? TimeZone = null,
    string? City = null
);
