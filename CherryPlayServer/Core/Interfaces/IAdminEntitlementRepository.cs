using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IAdminEntitlementRepository
{
    Task<EntitlementRevocation?> GetRevocationAsync(Guid entitlementId, Guid revocationId);
    Task<EntitlementRevocation?> GetRevocationByIdAsync(Guid revocationId);
    Task<bool> AuditIdExistsAsync(Guid eventId);
    Task<IReadOnlyCollection<EntitlementRevocation>> GetRevocationsAsync(Guid entitlementId);
    Task<AdminPersistenceOutcome> PersistRevocationAsync(Guid entitlementId, Guid revocationId, Guid adminId, string? note, DateTime createdAt);
    Task<AdminPersistenceOutcome> PersistGrantAsync(Guid organizerId, Guid packageId, Guid adminId, string? note, Guid entitlementId, DateTime grantedAt);
    Task<bool> OrganizerExistsAsync(Guid organizerId);
    Task<ThemePackage?> GetActivePackageAsync(Guid packageId);
    Task<AdminEntitlement?> GetActiveEntitlementAsync(Guid organizerId, Guid packageId);
    Task<AdminEntitlementState?> GetEntitlementStateAsync(Guid entitlementId);
    Task<AdminPersistenceOutcome> PersistLegacyRevokeAsync(Guid organizerId, Guid entitlementId, Guid adminId, string? note, DateTime revokedAt);
    Task<AdminEntitlement?> GetEntitlementAsync(Guid entitlementId);
}
