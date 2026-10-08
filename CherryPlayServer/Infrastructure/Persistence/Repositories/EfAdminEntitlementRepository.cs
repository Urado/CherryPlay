using System.Data;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Queries;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfAdminEntitlementRepository(AppDbContext db) : IAdminEntitlementRepository
{
    public async Task<EntitlementRevocation?> GetRevocationAsync(Guid entitlementId, Guid revocationId)
    {
        var log = await db.AdminAuditLogs.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == revocationId && x.Action == AdminAuditActionNames.RevokePackage && x.EntitlementId == entitlementId);
        return log is null ? null : ToRevocation(log);
    }

    public async Task<EntitlementRevocation?> GetRevocationByIdAsync(Guid revocationId)
    {
        var log = await db.AdminAuditLogs.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == revocationId && x.Action == AdminAuditActionNames.RevokePackage);
        return log is null ? null : ToRevocation(log);
    }

    public Task<bool> AuditIdExistsAsync(Guid eventId)
    {
        return db.AdminAuditLogs.AsNoTracking().AnyAsync(x => x.Id == eventId);
    }

    public async Task<IReadOnlyCollection<EntitlementRevocation>> GetRevocationsAsync(Guid entitlementId)
    {
        var logs = await db.AdminAuditLogs.AsNoTracking()
            .Where(x => x.Action == AdminAuditActionNames.RevokePackage && x.EntitlementId == entitlementId)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync();
        return Array.AsReadOnly(logs.Select(ToRevocation).ToArray());
    }

    public async Task<AdminPersistenceOutcome> PersistRevocationAsync(Guid entitlementId, Guid revocationId, Guid adminId, string? note, DateTime now)
    {
        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted)
            : null;
        var updated = db.Database.IsRelational()
            ? await db.OrganizerEntitlements
                .Where(x => x.Id == entitlementId && x.RevokedAt == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.RevokedAt, now))
            : await RevokeInMemoryAsync(entitlementId, now, null);
        if (updated == 0)
        {
            if (transaction is not null) await transaction.RollbackAsync();
            return AdminPersistenceOutcome.NoChange;
        }

        var entitlement = await db.OrganizerEntitlements.AsNoTracking()
            .Where(x => x.Id == entitlementId)
            .Select(x => new { x.OrganizerId, x.PackageId })
            .SingleAsync();
        db.AdminAuditLogs.Add(new AdminAuditLogEf
        {
            Id = revocationId,
            AdminId = adminId,
            Action = AdminAuditActionNames.RevokePackage,
            TargetOrganizerId = entitlement.OrganizerId,
            PackageId = entitlement.PackageId,
            EntitlementId = entitlementId,
            Note = note,
            CreatedAt = now
        });
        try
        {
            await db.SaveChangesAsync();
            if (transaction is not null) await transaction.CommitAsync();
        }
        catch (Exception exception) when (IsUniqueConstraintViolation(exception))
        {
            if (transaction is not null)
            {
                try
                {
                    await transaction.RollbackAsync();
                }
                catch (InvalidOperationException)
                {
                }
            }
            return AdminPersistenceOutcome.UniqueConflict;
        }
        return AdminPersistenceOutcome.Applied;
    }

    public async Task<AdminPersistenceOutcome> PersistGrantAsync(Guid organizerId, Guid packageId, Guid adminId, string? note, Guid entitlementId, DateTime now)
    {
        var package = await db.ThemePackages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == packageId && x.IsActive);
        if (package is null) return AdminPersistenceOutcome.NoChange;

        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable)
            : null;
        var active = await db.OrganizerEntitlements.AsNoTracking()
            .Where(OrganizerEntitlementPredicates.IsActive(now))
            .FirstOrDefaultAsync(x => x.OrganizerId == organizerId && x.PackageId == packageId);
        if (active is not null)
        {
            if (transaction is not null) await transaction.RollbackAsync();
            return AdminPersistenceOutcome.NoChange;
        }

        var entitlement = new OrganizerEntitlementEf
        {
            Id = entitlementId,
            OrganizerId = organizerId,
            PackageId = packageId,
            Kind = "lifetime",
            Source = "admin_grant",
            GrantedAt = now,
            Note = note
        };
        db.OrganizerEntitlements.Add(entitlement);
        db.AdminAuditLogs.Add(new AdminAuditLogEf
        {
            Id = Guid.NewGuid(),
            AdminId = adminId,
            Action = AdminAuditActionNames.GrantPackage,
            TargetOrganizerId = organizerId,
            PackageId = packageId,
            EntitlementId = entitlement.Id,
            Note = note,
            CreatedAt = now
        });
        try
        {
            await db.SaveChangesAsync();
            if (transaction is not null) await transaction.CommitAsync();
        }
        catch (Exception exception) when (IsSerializationFailure(exception))
        {
            if (transaction is not null)
            {
                try
                {
                    await transaction.RollbackAsync();
                }
                catch (InvalidOperationException)
                {
                }
            }
            db.ChangeTracker.Clear();
            return AdminPersistenceOutcome.NoChange;
        }

        return AdminPersistenceOutcome.Applied;
    }

    public Task<bool> OrganizerExistsAsync(Guid organizerId)
    {
        return db.Organizers.AsNoTracking().AnyAsync(x => x.Id == organizerId && !x.IsDeleted);
    }

    public async Task<CherryPlayServer.Core.Entities.ThemePackage?> GetActivePackageAsync(Guid packageId)
    {
        var package = await db.ThemePackages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == packageId && x.IsActive);
        return package is null ? null : new CherryPlayServer.Core.Entities.ThemePackage
        {
            Id = package.Id,
            Code = package.Code,
            Name = package.Name,
            IsAutoGranted = package.IsAutoGranted,
            IsActive = package.IsActive
        };
    }

    public async Task<AdminEntitlement?> GetActiveEntitlementAsync(Guid organizerId, Guid packageId)
    {
        var row = await db.OrganizerEntitlements.AsNoTracking()
            .Where(OrganizerEntitlementPredicates.IsActive(DateTime.UtcNow))
            .Where(x => x.OrganizerId == organizerId && x.PackageId == packageId)
            .Join(db.ThemePackages.AsNoTracking(), x => x.PackageId, p => p.Id, (x, p) => new { Entitlement = x, Package = p })
            .FirstOrDefaultAsync();
        return row is null ? null : await ToAdminEntitlement(row.Entitlement, row.Package);
    }

    public async Task<AdminPersistenceOutcome> PersistLegacyRevokeAsync(Guid organizerId, Guid entitlementId, Guid adminId, string? note, DateTime now)
    {
        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted)
            : null;
        var updated = db.Database.IsRelational()
            ? await db.OrganizerEntitlements
                .Where(x => x.Id == entitlementId && x.OrganizerId == organizerId && x.RevokedAt == null)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.RevokedAt, now)
                    .SetProperty(x => x.Note, x => string.IsNullOrWhiteSpace(note)
                        ? x.Note
                        : string.IsNullOrWhiteSpace(x.Note)
                            ? note
                            : x.Note + $"\n\n--- revoke: {now:O} ---\n" + note))
            : await RevokeInMemoryAsync(entitlementId, now, note, organizerId);
        if (updated == 0)
        {
            if (transaction is not null) await transaction.RollbackAsync();
            return AdminPersistenceOutcome.NoChange;
        }

        var packageId = await db.OrganizerEntitlements.AsNoTracking()
            .Where(x => x.Id == entitlementId && x.OrganizerId == organizerId)
            .Select(x => x.PackageId)
            .SingleAsync();
        db.AdminAuditLogs.Add(new AdminAuditLogEf
        {
            Id = Guid.NewGuid(),
            AdminId = adminId,
            Action = AdminAuditActionNames.RevokePackage,
            TargetOrganizerId = organizerId,
            PackageId = packageId,
            EntitlementId = entitlementId,
            Note = note,
            CreatedAt = now
        });
        await db.SaveChangesAsync();
        if (transaction is not null) await transaction.CommitAsync();
        return AdminPersistenceOutcome.Applied;
    }

    public async Task<AdminEntitlementState?> GetEntitlementStateAsync(Guid entitlementId)
    {
        return await db.OrganizerEntitlements.AsNoTracking()
            .Where(x => x.Id == entitlementId)
            .Select(x => new AdminEntitlementState(x.Id, x.OrganizerId, x.PackageId, x.RevokedAt))
            .FirstOrDefaultAsync();
    }

    public async Task<AdminEntitlement?> GetEntitlementAsync(Guid entitlementId)
    {
        var row = await db.OrganizerEntitlements.AsNoTracking()
            .Where(x => x.Id == entitlementId)
            .Join(db.ThemePackages.AsNoTracking(), x => x.PackageId, p => p.Id, (x, p) => new { Entitlement = x, Package = p })
            .FirstOrDefaultAsync();
        return row is null ? null : await ToAdminEntitlement(row.Entitlement, row.Package);
    }

    private async Task<AdminEntitlement> ToAdminEntitlement(OrganizerEntitlementEf entitlement, ThemePackageEf package)
    {
        var auditRows = await db.AdminAuditLogs.AsNoTracking()
            .Where(x => x.EntitlementId == entitlement.Id)
            .Where(x => x.Action == AdminAuditActionNames.GrantPackage || x.Action == AdminAuditActionNames.RevokePackage)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync();
        var grant = auditRows.LastOrDefault(x => x.Action == AdminAuditActionNames.GrantPackage);
        var revoke = auditRows.LastOrDefault(x => x.Action == AdminAuditActionNames.RevokePackage);
        var actorIds = new[] { grant?.AdminId, revoke?.AdminId }.Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        var names = await db.Organizers.IgnoreQueryFilters().AsNoTracking()
            .Where(x => actorIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name);
        return new AdminEntitlement(
            entitlement.Id,
            entitlement.PackageId,
            package.Code,
            package.Name,
            entitlement.Kind,
            entitlement.Source,
            entitlement.GrantedAt,
            grant?.AdminId,
            grant is null ? null : names.GetValueOrDefault(grant.AdminId),
            entitlement.ExpiresAt,
            entitlement.UsesRemaining,
            entitlement.RevokedAt,
            revoke?.AdminId,
            entitlement.Note);
    }

    private async Task<int> RevokeInMemoryAsync(Guid entitlementId, DateTime now, string? note, Guid? organizerId = null)
    {
        var entitlement = await db.OrganizerEntitlements.FirstOrDefaultAsync(x =>
            x.Id == entitlementId && x.RevokedAt == null && (organizerId == null || x.OrganizerId == organizerId));
        if (entitlement is null) return 0;
        entitlement.RevokedAt = now;
        if (!string.IsNullOrWhiteSpace(note))
        {
            entitlement.Note = string.IsNullOrWhiteSpace(entitlement.Note)
                ? note
                : $"{entitlement.Note}\n\n--- revoke: {now:O} ---\n{note}";
        }
        return 1;
    }

    private static EntitlementRevocation ToRevocation(AdminAuditLogEf log)
    {
        return new EntitlementRevocation(log.Id, log.EntitlementId, log.AdminId, log.Note, log.CreatedAt);
    }

    private static bool IsSerializationFailure(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgres && postgres.SqlState == PostgresErrorCodes.SerializationFailure)
            {
                return true;
            }
        }
        return false;
    }

    private static bool IsUniqueConstraintViolation(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgres && postgres.SqlState == PostgresErrorCodes.UniqueViolation) return true;
        }
        return false;
    }
}
