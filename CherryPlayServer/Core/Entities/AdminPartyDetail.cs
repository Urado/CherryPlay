namespace CherryPlayServer.Core.Entities;

public sealed record AdminPartyDetail(
    Party Party,
    string OrganizerName,
    bool IsOrganizerDeleted,
    PlaybackState? PlaybackState,
    bool IsOrganizerConnected);
