namespace CherryPlayServer.Core.Interfaces;

public enum AdminEntitlementRevocationResultKind
{
    Created,
    AlreadyCreated,
    EntitlementNotFound,
    AlreadyRevoked,
    EventIdConflict
}
