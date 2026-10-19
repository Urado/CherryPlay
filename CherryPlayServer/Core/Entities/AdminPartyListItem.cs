using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Entities;

public sealed record AdminPartyListItem(
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
