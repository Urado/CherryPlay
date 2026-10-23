using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Models;

public sealed record AdminPartyListItemDto(
    Guid Id,
    Guid OrganizerId,
    string OrganizerName,
    bool IsOrganizerDeleted,
    string Name,
    string? Title,
    string ShortCode,
    string? City,
    DateTime? EventDateTime,
    PartyLifecycleState PartyLifecycleState,
    bool IsListedInCatalog,
    bool IsDeleted,
    bool HasActiveSession,
    bool IsOrganizerConnected);

public sealed record AdminPartyListDto(
    IReadOnlyList<AdminPartyListItemDto> Items,
    int Total,
    int Page,
    int PageSize);

public sealed record AdminPartyLifecycleRequest(PartyLifecycleState PartyLifecycleState);

public sealed record AdminPartyCatalogVisibilityRequest(bool IsListedInCatalog);

public sealed record AdminPartyMutationDto(
    Guid Id,
    PartyLifecycleState PartyLifecycleState,
    bool IsListedInCatalog);

public sealed record AdminPlaybackStateDto(
    bool IsActive,
    string? CurrentTrackId,
    PlaybackStatus Status,
    double Position,
    double Duration,
    double Volume,
    PlaybackMode Mode,
    IReadOnlyList<string> PlayedTrackIds,
    IReadOnlyList<string> DisabledTrackIds,
    IReadOnlyList<string> DisabledGroupIds,
    DateTime? SessionStartedAt,
    DateTime LastUpdatedAt)
{
    public static AdminPlaybackStateDto? From(PlaybackState? state) => state is null
        ? null
        : new AdminPlaybackStateDto(
            state.IsActive,
            state.CurrentTrackId,
            state.Status,
            state.Position,
            state.Duration,
            state.Volume,
            state.Mode,
            Array.AsReadOnly(state.PlayedTrackIds.ToArray()),
            Array.AsReadOnly(state.DisabledTrackIds.ToArray()),
            Array.AsReadOnly(state.DisabledGroupIds.ToArray()),
            state.SessionStartedAt,
            state.LastUpdatedAt);
}

public sealed record AdminPartyDetailDto(
    Guid Id,
    Guid OrganizerId,
    string OrganizerName,
    bool IsOrganizerDeleted,
    string Name,
    string? Title,
    string? Subtitle,
    string ShortCode,
    string? City,
    DateTime CreatedAt,
    DateTime? EventDateTime,
    DateTime? EventEndDateTime,
    PartyLifecycleState PartyLifecycleState,
    bool IsListedInCatalog,
    bool IsDeleted,
    bool HasActiveSession,
    bool IsOrganizerConnected,
    CherryPlayServer.Core.Enums.PartyThemeId PartyThemeId,
    Dictionary<string, object>? CustomizationSettings,
    string? Description,
    string? Place,
    string? Schedule,
    string? TimeZone,
    string? ShortDescription,
    string? ExternalLinkUrl,
    string? ExternalLinkText,
    IReadOnlyList<string> DanceTags,
    PartyPlaylistDto Playlist,
    AdminPlaybackStateDto? PlaybackState);

public sealed record AdminPartySessionResetDto(
    Guid Id,
    bool WasReset,
    bool HasActiveSession,
    bool IsOrganizerConnected,
    AdminPlaybackStateDto? PlaybackState);
