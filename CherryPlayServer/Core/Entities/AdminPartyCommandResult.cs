namespace CherryPlayServer.Core.Entities;

public sealed record AdminPartyCommandResult(
    AdminPartyCommandResultKind Kind,
    Party? Party,
    PlaybackState? PlaybackState = null,
    bool WasReset = false,
    bool IsOrganizerConnected = false);
