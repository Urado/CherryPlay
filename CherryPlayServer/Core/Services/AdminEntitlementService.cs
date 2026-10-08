using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Core.Services;

public class AdminEntitlementService(IAdminEntitlementRepository repository) : IAdminEntitlementService
{
    public Task<EntitlementRevocation?> GetRevocationAsync(Guid entitlementId, Guid revocationId)
    {
        return repository.GetRevocationAsync(entitlementId, revocationId);
    }

    public Task<EntitlementRevocation?> GetRevocationByIdAsync(Guid revocationId)
    {
        return repository.GetRevocationByIdAsync(revocationId);
    }

    public Task<IReadOnlyCollection<EntitlementRevocation>> GetRevocationsAsync(Guid entitlementId)
    {
        return repository.GetRevocationsAsync(entitlementId);
    }

    public async Task<AdminEntitlementRevocationResult> RevokeAsync(Guid entitlementId, Guid revocationId, Guid adminId, string? note)
    {
        var existing = await repository.GetRevocationByIdAsync(revocationId);
        if (existing is not null)
        {
            return existing.EntitlementId == entitlementId
                ? new(AdminEntitlementRevocationResultKind.AlreadyCreated, existing)
                : new(AdminEntitlementRevocationResultKind.EventIdConflict, null);
        }
        if (await repository.AuditIdExistsAsync(revocationId))
        {
            return new(AdminEntitlementRevocationResultKind.EventIdConflict, null);
        }
        var state = await repository.GetEntitlementStateAsync(entitlementId);
        if (state is null) return new(AdminEntitlementRevocationResultKind.EntitlementNotFound, null);
        if (state.RevokedAt is not null) return new(AdminEntitlementRevocationResultKind.AlreadyRevoked, null);

        var now = DateTime.UtcNow;
        var outcome = await repository.PersistRevocationAsync(entitlementId, revocationId, adminId, note, now);
        if (outcome == AdminPersistenceOutcome.Applied)
        {
            return new(AdminEntitlementRevocationResultKind.Created, new EntitlementRevocation(revocationId, entitlementId, adminId, note, now));
        }

        var racedEvent = await repository.GetRevocationByIdAsync(revocationId);
        if (racedEvent is not null)
        {
            return racedEvent.EntitlementId == entitlementId
                ? new(AdminEntitlementRevocationResultKind.AlreadyCreated, racedEvent)
                : new(AdminEntitlementRevocationResultKind.EventIdConflict, null);
        }
        if (outcome == AdminPersistenceOutcome.UniqueConflict || await repository.AuditIdExistsAsync(revocationId))
        {
            return new(AdminEntitlementRevocationResultKind.EventIdConflict, null);
        }
        state = await repository.GetEntitlementStateAsync(entitlementId);
        return new(state is null ? AdminEntitlementRevocationResultKind.EntitlementNotFound : AdminEntitlementRevocationResultKind.AlreadyRevoked, null);
    }

    public async Task<AdminGrantResult> GrantAsync(Guid organizerId, Guid packageId, Guid adminId, string? note)
    {
        if (!await repository.OrganizerExistsAsync(organizerId)) return new(AdminGrantResultKind.OrganizerNotFound, null);
        var package = await repository.GetActivePackageAsync(packageId);
        if (package is null) return new(AdminGrantResultKind.PackageNotFound, null);
        if (package.IsAutoGranted) return new(AdminGrantResultKind.PackageAutoGranted, null);
        var active = await repository.GetActiveEntitlementAsync(organizerId, packageId);
        if (active is not null) return new(AdminGrantResultKind.AlreadyActive, active);
        var entitlementId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var outcome = await repository.PersistGrantAsync(organizerId, packageId, adminId, note, entitlementId, now);
        if (outcome == AdminPersistenceOutcome.Applied)
        {
            var created = await repository.GetEntitlementAsync(entitlementId);
            return new(AdminGrantResultKind.Created, created);
        }
        active = await repository.GetActiveEntitlementAsync(organizerId, packageId);
        if (active is not null) return new(AdminGrantResultKind.AlreadyActive, active);
        if (!await repository.OrganizerExistsAsync(organizerId)) return new(AdminGrantResultKind.OrganizerNotFound, null);
        package = await repository.GetActivePackageAsync(packageId);
        if (package is null) return new(AdminGrantResultKind.PackageNotFound, null);
        throw new InvalidOperationException("The grant could not be persisted and no current conflict was found.");
    }

    public async Task<AdminLegacyRevokeResult> RevokeLegacyAsync(Guid organizerId, Guid entitlementId, Guid adminId, string? note)
    {
        var state = await repository.GetEntitlementStateAsync(entitlementId);
        if (state is null || state.OrganizerId != organizerId) return new(AdminLegacyRevokeResultKind.EntitlementNotFound);
        if (state.RevokedAt is not null) return new(AdminLegacyRevokeResultKind.AlreadyRevoked);
        var revokedAt = NormalizeToPostgresTimestamp(DateTime.UtcNow);
        var outcome = await repository.PersistLegacyRevokeAsync(organizerId, entitlementId, adminId, note, revokedAt);
        if (outcome == AdminPersistenceOutcome.Applied) return new(AdminLegacyRevokeResultKind.Revoked);
        state = await repository.GetEntitlementStateAsync(entitlementId);
        if (state is null || state.OrganizerId != organizerId) return new(AdminLegacyRevokeResultKind.EntitlementNotFound);
        return new(AdminLegacyRevokeResultKind.AlreadyRevoked);
    }

    public Task<AdminEntitlement?> GetEntitlementAsync(Guid entitlementId)
    {
        return repository.GetEntitlementAsync(entitlementId);
    }

    private static DateTime NormalizeToPostgresTimestamp(DateTime value)
    {
        return new DateTime(value.Ticks - value.Ticks % 10, DateTimeKind.Utc);
    }
}
