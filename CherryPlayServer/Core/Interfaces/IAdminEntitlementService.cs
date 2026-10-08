using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IAdminEntitlementService
{
    Task<EntitlementRevocation?> GetRevocationAsync(Guid entitlementId, Guid revocationId);
    Task<EntitlementRevocation?> GetRevocationByIdAsync(Guid revocationId);
    Task<IReadOnlyCollection<EntitlementRevocation>> GetRevocationsAsync(Guid entitlementId);
    Task<AdminEntitlementRevocationResult> RevokeAsync(Guid entitlementId, Guid revocationId, Guid adminId, string? note);
    Task<AdminGrantResult> GrantAsync(Guid organizerId, Guid packageId, Guid adminId, string? note);
    Task<AdminLegacyRevokeResult> RevokeLegacyAsync(Guid organizerId, Guid entitlementId, Guid adminId, string? note);
    Task<AdminEntitlement?> GetEntitlementAsync(Guid entitlementId);
}
