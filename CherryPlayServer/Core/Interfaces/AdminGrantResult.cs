using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public record AdminGrantResult(AdminGrantResultKind Kind, AdminEntitlement? Entitlement);
