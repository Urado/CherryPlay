using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public record AdminEntitlementRevocationResult(AdminEntitlementRevocationResultKind Kind, EntitlementRevocation? Revocation);
