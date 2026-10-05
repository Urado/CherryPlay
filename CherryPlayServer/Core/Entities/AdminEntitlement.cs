namespace CherryPlayServer.Core.Entities;

public record AdminEntitlement(
    Guid Id,
    Guid PackageId,
    string PackageCode,
    string PackageName,
    string Kind,
    string Source,
    DateTime GrantedAt,
    Guid? GrantedByAdminId,
    string? GrantedByAdminName,
    DateTime? ExpiresAt,
    int? UsesRemaining,
    DateTime? RevokedAt,
    Guid? RevokedByAdminId,
    string? Note);
