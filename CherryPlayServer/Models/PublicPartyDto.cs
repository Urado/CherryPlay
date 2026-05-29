using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record PublicPartyDto(
    string Id,
    string Name,
    string? Title,
    string? Subtitle,
    PartyThemeId PartyThemeId,
    bool HasActiveSession,
    bool IsListedInCatalog,
    PartyLifecycleState PartyLifecycleState = PartyLifecycleState.Draft,
    PartyDisplayStatus PartyDisplayStatus = PartyDisplayStatus.Scheduled,
    Dictionary<string, object>? CustomizationSettings = null,
    string? SessionStartedAt = null,
    string? Description = null,
    string? Place = null,
    string? City = null,
    string? EventDateTime = null,
    string? EventEndDateTime = null,
    string? Schedule = null,
    string? TimeZone = null,
    string? ShortDescription = null,
    string? ExternalLinkUrl = null,
    string? ExternalLinkText = null,
    IReadOnlyList<string>? DanceTags = null
);
