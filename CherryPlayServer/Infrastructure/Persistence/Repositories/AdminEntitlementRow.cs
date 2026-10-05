namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public record AdminEntitlementRow(
    Guid Id,
    Guid PackageId,
    string PackageCode,
    string PackageName,
    string Kind,
    string Source,
    DateTime GrantedAt,
    DateTime? ExpiresAt,
    int? UsesRemaining,
    DateTime? RevokedAt,
    string? Note);
