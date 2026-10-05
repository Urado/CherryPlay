namespace CherryPlayServer.Core.Entities;

public record AdminEntitlementState(Guid Id, Guid OrganizerId, Guid PackageId, DateTime? RevokedAt);
