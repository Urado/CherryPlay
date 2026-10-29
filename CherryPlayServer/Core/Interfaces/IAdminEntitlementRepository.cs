using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IAdminEntitlementRepository
{
    Task<EntitlementRevocation?> GetRevocationAsync(Guid entitlementId, Guid revocationId);
    Task<EntitlementRevocation?> GetRevocationByIdAsync(Guid revocationId);
    Task<bool> AuditIdExistsAsync(Guid eventId);
    Task<IReadOnlyCollection<EntitlementRevocation>> GetRevocationsAsync(Guid entitlementId);
    Task<AdminPersistenceOutcome> PersistRevocationAsync(Guid entitlementId, Guid revocationId, Guid adminId, string? note, DateTime createdAt);
    Task<AdminPersistenceOutcome> PersistGrantAsync(OrganizerEntitlement entitlement, Guid adminId);
    Task<bool> OrganizerExistsAsync(Guid organizerId);
    Task<ThemePackage?> GetActivePackageAsync(Guid packageId);
    Task<AdminEntitlement?> GetActiveEntitlementAsync(Guid organizerId, Guid packageId);
    Task<IReadOnlyList<AdminEntitlement>> GetOrganizerEntitlementsAsync(Guid organizerId, bool activeOnly);
    Task<AdminEntitlementState?> GetEntitlementStateAsync(Guid entitlementId);
    Task<AdminPersistenceOutcome> PersistLegacyRevokeAsync(Guid organizerId, Guid entitlementId, Guid adminId, string? note, DateTime revokedAt);
    Task<AdminEntitlement?> GetEntitlementAsync(Guid entitlementId);
}
