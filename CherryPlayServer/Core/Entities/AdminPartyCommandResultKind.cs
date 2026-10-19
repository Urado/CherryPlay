namespace CherryPlayServer.Core.Entities;

public enum AdminPartyCommandResultKind
{
    Updated,
    Unchanged,
    NotFound,
    ActiveConnectedSession,
    ResetBlocked
}
