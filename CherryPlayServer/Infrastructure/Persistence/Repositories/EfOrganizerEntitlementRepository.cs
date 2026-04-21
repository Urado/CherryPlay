using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence.Queries;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfOrganizerEntitlementRepository : IOrganizerEntitlementRepository
{
    private readonly AppDbContext _context;

    public EfOrganizerEntitlementRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<OrganizerEntitlement>> GetByOrganizerIdAsync(Guid organizerId)
    {
        var efs = await _context.OrganizerEntitlements.AsNoTracking().Where(x => x.OrganizerId == organizerId).ToListAsync();
        return efs.Select(ToDomain).ToList();
    }

    public async Task<OrganizerEntitlement?> GetByIdAsync(Guid entitlementId)
    {
        var ef = await _context.OrganizerEntitlements.FirstOrDefaultAsync(x => x.Id == entitlementId);
        return ef == null ? null : ToDomain(ef);
    }

    public async Task<OrganizerEntitlement?> GetActiveByOrganizerAndPackageAsync(Guid organizerId, Guid packageId)
    {
        var now = DateTime.UtcNow;
        var isActiveAtNow = OrganizerEntitlementPredicates.IsActive(now);
        var ef = await _context.OrganizerEntitlements.AsNoTracking()
            .Where(isActiveAtNow)
            .FirstOrDefaultAsync(x => x.OrganizerId == organizerId && x.PackageId == packageId);
        return ef == null ? null : ToDomain(ef);
    }

    public async Task AddAsync(OrganizerEntitlement entitlement)
    {
        _context.OrganizerEntitlements.Add(ToEf(entitlement));
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(OrganizerEntitlement entitlement)
    {
        var ef = await _context.OrganizerEntitlements.FirstOrDefaultAsync(x => x.Id == entitlement.Id);
        if (ef == null) return;
        ef.RevokedAt = entitlement.RevokedAt;
        ef.Note = entitlement.Note;
        await _context.SaveChangesAsync();
    }

    private static OrganizerEntitlement ToDomain(Persistence.Entities.OrganizerEntitlementEf ef) => new()
    {
        Id = ef.Id,
        OrganizerId = ef.OrganizerId,
        PackageId = ef.PackageId,
        GrantedAt = ef.GrantedAt,
        ExpiresAt = ef.ExpiresAt,
        UsesRemaining = ef.UsesRemaining,
        RevokedAt = ef.RevokedAt,
        Note = ef.Note,
        Kind = ef.Kind == "subscription" ? EntitlementKind.Subscription : ef.Kind == "event_quota" ? EntitlementKind.EventQuota : EntitlementKind.Lifetime,
        Source = ef.Source == "purchase" ? EntitlementSource.Purchase : ef.Source == "trial" ? EntitlementSource.Trial : EntitlementSource.AdminGrant,
    };

    private static Persistence.Entities.OrganizerEntitlementEf ToEf(OrganizerEntitlement d) => new()
    {
        Id = d.Id,
        OrganizerId = d.OrganizerId,
        PackageId = d.PackageId,
        GrantedAt = d.GrantedAt,
        ExpiresAt = d.ExpiresAt,
        UsesRemaining = d.UsesRemaining,
        RevokedAt = d.RevokedAt,
        Note = d.Note,
        Kind = d.Kind == EntitlementKind.Subscription ? "subscription" : d.Kind == EntitlementKind.EventQuota ? "event_quota" : "lifetime",
        Source = d.Source == EntitlementSource.Purchase ? "purchase" : d.Source == EntitlementSource.Trial ? "trial" : "admin_grant",
    };
}
