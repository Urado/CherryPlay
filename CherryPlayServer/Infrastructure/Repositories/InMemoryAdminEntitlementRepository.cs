using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Utils;

namespace CherryPlayServer.Infrastructure.Repositories;

public sealed class InMemoryAdminEntitlementRepository(
    IOrganizerRepository organizers,
    IOrganizerEntitlementRepository entitlements,
    IThemePackageRepository packages,
    IAdminAuditLogRepository auditLog) : IAdminEntitlementRepository
{
    private readonly ConcurrentDictionary<Guid, AdminAuditLog> _logs = new();
    private readonly SemaphoreSlim _gate = new(1, 1);

    public Task<EntitlementRevocation?> GetRevocationAsync(Guid entitlementId, Guid revocationId)
    {
        var log = _logs.GetValueOrDefault(revocationId);
        return Task.FromResult(log is not null && log.Action == AdminAuditAction.RevokePackage && log.EntitlementId == entitlementId
            ? ToRevocation(log)
            : null);
    }

    public Task<EntitlementRevocation?> GetRevocationByIdAsync(Guid revocationId)
    {
        var log = _logs.GetValueOrDefault(revocationId);
        return Task.FromResult(log is not null && log.Action == AdminAuditAction.RevokePackage ? ToRevocation(log) : null);
    }

    public Task<bool> AuditIdExistsAsync(Guid eventId) => Task.FromResult(_logs.ContainsKey(eventId));

    public Task<IReadOnlyCollection<EntitlementRevocation>> GetRevocationsAsync(Guid entitlementId)
    {
        IReadOnlyCollection<EntitlementRevocation> items = Array.AsReadOnly(_logs.Values
            .Where(x => x.Action == AdminAuditAction.RevokePackage && x.EntitlementId == entitlementId)
            .OrderBy(x => x.CreatedAt)
            .Select(ToRevocation)
            .ToArray());
        return Task.FromResult(items);
    }

    public async Task<AdminPersistenceOutcome> PersistRevocationAsync(Guid entitlementId, Guid revocationId, Guid adminId, string? note, DateTime createdAt)
    {
        await _gate.WaitAsync();
        try
        {
            var entitlement = await entitlements.GetByIdAsync(entitlementId);
            if (entitlement is null || entitlement.RevokedAt is not null) return AdminPersistenceOutcome.NoChange;
            if (_logs.ContainsKey(revocationId)) return AdminPersistenceOutcome.UniqueConflict;
            entitlement.RevokedAt = createdAt;
            await entitlements.UpdateAsync(entitlement);
            return await AddAuditAsync(revocationId, adminId, AdminAuditAction.RevokePackage, entitlement.OrganizerId, entitlement.PackageId, entitlementId, note, createdAt)
                ? AdminPersistenceOutcome.Applied
                : AdminPersistenceOutcome.UniqueConflict;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<AdminPersistenceOutcome> PersistGrantAsync(OrganizerEntitlement entitlement, Guid adminId)
    {
        await _gate.WaitAsync();
        try
        {
            var package = await packages.GetByIdAsync(entitlement.PackageId);
            if (package is null || !package.IsActive || package.IsAutoGranted) return AdminPersistenceOutcome.NoChange;
            if (await organizers.GetByIdAsync(entitlement.OrganizerId) is null) return AdminPersistenceOutcome.NoChange;
            if (await entitlements.GetActiveByOrganizerAndPackageAsync(entitlement.OrganizerId, entitlement.PackageId) is not null)
            {
                return AdminPersistenceOutcome.NoChange;
            }
            await entitlements.AddAsync(entitlement);
            await AddAuditAsync(Guid.NewGuid(), adminId, AdminAuditAction.GrantPackage, entitlement.OrganizerId, entitlement.PackageId, entitlement.Id, entitlement.Note, entitlement.GrantedAt);
            return AdminPersistenceOutcome.Applied;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<bool> OrganizerExistsAsync(Guid organizerId) => await organizers.GetByIdAsync(organizerId) is not null;

    public async Task<ThemePackage?> GetActivePackageAsync(Guid packageId)
    {
        var package = await packages.GetByIdAsync(packageId);
        return package is { IsActive: true } ? package : null;
    }

    public async Task<AdminEntitlement?> GetActiveEntitlementAsync(Guid organizerId, Guid packageId)
    {
        var entitlement = await entitlements.GetActiveByOrganizerAndPackageAsync(organizerId, packageId);
        return entitlement is null ? null : await ToAdminEntitlementAsync(entitlement);
    }

    public async Task<IReadOnlyList<AdminEntitlement>> GetOrganizerEntitlementsAsync(Guid organizerId, bool activeOnly)
    {
        var now = DateTime.UtcNow;
        var rows = await entitlements.GetByOrganizerIdAsync(organizerId);
        var activeRows = activeOnly ? rows.Where(x => EntitlementRules.IsActiveAt(x, now)) : rows;
        var result = new List<AdminEntitlement>();
        foreach (var entitlement in activeRows.OrderByDescending(x => x.GrantedAt))
        {
            result.Add(await ToAdminEntitlementAsync(entitlement));
        }
        return Array.AsReadOnly(result.ToArray());
    }

    public async Task<AdminEntitlementState?> GetEntitlementStateAsync(Guid entitlementId)
    {
        var entitlement = await entitlements.GetByIdAsync(entitlementId);
        return entitlement is null
            ? null
            : new AdminEntitlementState(entitlement.Id, entitlement.OrganizerId, entitlement.PackageId, entitlement.RevokedAt);
    }

    public async Task<AdminPersistenceOutcome> PersistLegacyRevokeAsync(Guid organizerId, Guid entitlementId, Guid adminId, string? note, DateTime revokedAt)
    {
        await _gate.WaitAsync();
        try
        {
            var entitlement = await entitlements.GetByIdAsync(entitlementId);
            if (entitlement is null || entitlement.OrganizerId != organizerId || entitlement.RevokedAt is not null)
            {
                return AdminPersistenceOutcome.NoChange;
            }
            entitlement.RevokedAt = revokedAt;
            if (!string.IsNullOrWhiteSpace(note))
            {
                entitlement.Note = string.IsNullOrWhiteSpace(entitlement.Note)
                    ? note
                    : $"{entitlement.Note}\n\n--- revoke: {revokedAt:O} ---\n{note}";
            }
            await entitlements.UpdateAsync(entitlement);
            await AddAuditAsync(Guid.NewGuid(), adminId, AdminAuditAction.RevokePackage, organizerId, entitlement.PackageId, entitlementId, note, revokedAt);
            return AdminPersistenceOutcome.Applied;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<AdminEntitlement?> GetEntitlementAsync(Guid entitlementId)
    {
        var entitlement = await entitlements.GetByIdAsync(entitlementId);
        return entitlement is null ? null : await ToAdminEntitlementAsync(entitlement);
    }

    private async Task<AdminEntitlement> ToAdminEntitlementAsync(OrganizerEntitlement entitlement)
    {
        var package = await packages.GetByIdAsync(entitlement.PackageId)
            ?? throw new InvalidOperationException($"Theme package {entitlement.PackageId} was not found.");
        var grant = _logs.Values
            .Where(x => x.Action == AdminAuditAction.GrantPackage && x.EntitlementId == entitlement.Id)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefault();
        var revoke = _logs.Values
            .Where(x => x.Action == AdminAuditAction.RevokePackage && x.EntitlementId == entitlement.Id)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefault();
        var grantAdmin = grant is null ? null : await organizers.GetByIdAsync(grant.AdminId, true);
        return new AdminEntitlement(
            entitlement.Id,
            entitlement.PackageId,
            package.Code,
            package.Name,
            ToStorageKind(entitlement.Kind),
            ToStorageSource(entitlement.Source),
            entitlement.GrantedAt,
            grant?.AdminId,
            grantAdmin?.Name,
            entitlement.ExpiresAt,
            entitlement.UsesRemaining,
            entitlement.RevokedAt,
            revoke?.AdminId,
            entitlement.Note);
    }

    private async Task<bool> AddAuditAsync(Guid id, Guid adminId, AdminAuditAction action, Guid organizerId, Guid packageId, Guid entitlementId, string? note, DateTime createdAt)
    {
        var log = new AdminAuditLog
        {
            Id = id,
            AdminId = adminId,
            Action = action,
            TargetOrganizerId = organizerId,
            PackageId = packageId,
            EntitlementId = entitlementId,
            Note = note,
            CreatedAt = createdAt
        };
        if (!_logs.TryAdd(id, log)) return false;
        await auditLog.AddAsync(log);
        return true;
    }

    private static EntitlementRevocation ToRevocation(AdminAuditLog log) => new(log.Id, log.EntitlementId, log.AdminId, log.Note, log.CreatedAt);

    private static string ToStorageKind(EntitlementKind kind) => kind switch
    {
        EntitlementKind.Subscription => "subscription",
        EntitlementKind.EventQuota => "event_quota",
        _ => "lifetime"
    };

    private static string ToStorageSource(EntitlementSource source) => source switch
    {
        EntitlementSource.Purchase => "purchase",
        EntitlementSource.Trial => "trial",
        _ => "admin_grant"
    };
}
