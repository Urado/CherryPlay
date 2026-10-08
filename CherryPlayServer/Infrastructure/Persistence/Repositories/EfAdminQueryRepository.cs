using CherryPlayServer.Core;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Queries;
using CherryPlayServer.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfAdminQueryRepository(AppDbContext db) : IAdminQueryRepository
{
    public async Task<IReadOnlyList<AdminThemePackageView>> GetPackagesAsync()
    {
        var rows = await db.ThemePackages.AsNoTracking().Include(x => x.Items).OrderBy(x => x.Code)
            .Select(x => new { x.Id, x.Code, x.Name, x.IsAutoGranted, x.IsActive, ThemeIds = x.Items.Select(i => i.ThemeId).OrderBy(i => i).ToList() })
            .ToListAsync();
        var items = rows.Select(x => new AdminThemePackageView(x.Id, x.Code, x.Name, x.IsAutoGranted, x.IsActive, Array.AsReadOnly(x.ThemeIds.ToArray()))).ToArray();
        return Array.AsReadOnly(items);
    }

    public async Task<AdminOrganizerListView> GetOrganizersAsync(string? query, int page, int pageSize)
    {
        var organizers = db.Organizers.AsNoTracking().Where(x => !x.IsDeleted);
        if (!string.IsNullOrWhiteSpace(query))
        {
            var search = query.Trim();
            if (db.Database.IsRelational())
            {
                var pattern = $"%{search}%";
                var idsByEmail = db.EmailAccounts.AsNoTracking()
                    .Where(x => EF.Functions.ILike(x.Email, pattern))
                    .Select(x => x.OrganizerId)
                    .Distinct();
                organizers = organizers.Where(x => EF.Functions.ILike(x.Name, pattern) || idsByEmail.Contains(x.Id));
            }
            else
            {
                var organizerRows = await organizers.ToListAsync();
                var emailRows = await db.EmailAccounts.AsNoTracking().ToListAsync();
                var matchingIds = organizerRows
                    .Where(x => x.Name.Contains(search, StringComparison.OrdinalIgnoreCase)
                        || emailRows.Any(email => email.OrganizerId == x.Id
                            && email.Email.Contains(search, StringComparison.OrdinalIgnoreCase)))
                    .Select(x => x.Id)
                    .ToArray();
                organizers = organizers.Where(x => matchingIds.Contains(x.Id));
            }
        }

        var total = await organizers.CountAsync();
        var pageRows = await organizers.OrderBy(x => x.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new { x.Id, x.Name, x.Role, x.CreatedAt })
            .ToListAsync();
        var ids = pageRows.Select(x => x.Id).ToList();
        if (ids.Count == 0) return new AdminOrganizerListView(Array.AsReadOnly(Array.Empty<AdminOrganizerListItemView>()), total, page, pageSize);

        var emails = await db.EmailAccounts.AsNoTracking().Where(x => ids.Contains(x.OrganizerId))
            .GroupBy(x => x.OrganizerId)
            .Select(group => new { OrganizerId = group.Key, Email = group.OrderBy(x => x.CreatedAt).Select(x => x.Email).FirstOrDefault() })
            .ToDictionaryAsync(x => x.OrganizerId, x => x.Email);
        var providers = await db.OAuthAccounts.AsNoTracking().Where(x => ids.Contains(x.OrganizerId))
            .Select(x => new { x.OrganizerId, x.Provider }).Distinct().ToListAsync();
        var providerMap = providers.GroupBy(x => x.OrganizerId)
            .ToDictionary(group => group.Key, group => Array.AsReadOnly(group.Select(x => x.Provider).OrderBy(x => x).ToArray()));
        var activeFilter = OrganizerEntitlementPredicates.IsActive(DateTime.UtcNow);
        var counts = await db.OrganizerEntitlements.AsNoTracking().Where(activeFilter).Where(x => ids.Contains(x.OrganizerId))
            .GroupBy(x => x.OrganizerId).Select(group => new { OrganizerId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.OrganizerId, x => x.Count);
        var items = pageRows.Select(x => new AdminOrganizerListItemView(
            x.Id,
            x.Name,
            emails.GetValueOrDefault(x.Id),
            providerMap.GetValueOrDefault(x.Id, Array.AsReadOnly(Array.Empty<string>())),
            x.Role,
            counts.GetValueOrDefault(x.Id),
            x.CreatedAt)).ToList();
        return new AdminOrganizerListView(Array.AsReadOnly(items.ToArray()), total, page, pageSize);
    }

    public async Task<AdminOrganizerDetailView?> GetOrganizerAsync(Guid organizerId)
    {
        var organizer = await db.Organizers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == organizerId && !x.IsDeleted);
        if (organizer is null) return null;
        var email = await db.EmailAccounts.AsNoTracking().Where(x => x.OrganizerId == organizerId)
            .OrderBy(x => x.CreatedAt).Select(x => x.Email).FirstOrDefaultAsync();
        var oauth = await db.OAuthAccounts.AsNoTracking().Where(x => x.OrganizerId == organizerId)
            .OrderBy(x => x.Provider)
            .Select(x => new AdminOauthAccountView(x.Provider, x.ProviderUserId, x.ProviderUserName))
            .ToArrayAsync();
        var rows = await LoadEntitlementRowsAsync(
            db.OrganizerEntitlements.AsNoTracking().Where(x => x.OrganizerId == organizerId));
        var entitlements = await BuildEntitlementsAsync(rows);
        return new AdminOrganizerDetailView(organizer.Id, organizer.Name, email, Array.AsReadOnly(oauth), organizer.Role, organizer.CreatedAt, Array.AsReadOnly(entitlements.ToArray()));
    }

    public Task<bool> OrganizerExistsAsync(Guid organizerId)
    {
        return db.Organizers.AsNoTracking().AnyAsync(x => x.Id == organizerId && !x.IsDeleted);
    }

    public async Task<IReadOnlyList<AdminEntitlement>> GetOrganizerEntitlementsAsync(Guid organizerId, bool activeOnly)
    {
        var query = db.OrganizerEntitlements.AsNoTracking().Where(x => x.OrganizerId == organizerId);
        if (activeOnly) query = query.Where(OrganizerEntitlementPredicates.IsActive(DateTime.UtcNow));
        var rows = await LoadEntitlementRowsAsync(query);
        var entitlements = await BuildEntitlementsAsync(rows);
        return Array.AsReadOnly(entitlements.ToArray());
    }

    private Task<List<AdminEntitlementRow>> LoadEntitlementRowsAsync(IQueryable<OrganizerEntitlementEf> query)
    {
        return query
            .OrderByDescending(x => x.GrantedAt)
            .Join(
                db.ThemePackages.AsNoTracking(),
                x => x.PackageId,
                p => p.Id,
                (x, p) => new AdminEntitlementRow(
                    x.Id,
                    x.PackageId,
                    p.Code,
                    p.Name,
                    x.Kind,
                    x.Source,
                    x.GrantedAt,
                    x.ExpiresAt,
                    x.UsesRemaining,
                    x.RevokedAt,
                    x.Note))
            .ToListAsync();
    }

    private async Task<List<AdminEntitlement>> BuildEntitlementsAsync(List<AdminEntitlementRow> rows)
    {
        var ids = rows.Select(x => x.Id).ToList();
        var audits = await db.AdminAuditLogs.AsNoTracking()
            .Where(x => x.EntitlementId != null && ids.Contains(x.EntitlementId.Value))
            .Where(x => x.Action == AdminAuditActionNames.GrantPackage || x.Action == AdminAuditActionNames.RevokePackage)
            .Select(x => new { x.EntitlementId, x.AdminId, x.Action, x.CreatedAt })
            .ToListAsync();
        var grantAdmins = audits.Where(x => x.Action == AdminAuditActionNames.GrantPackage && x.EntitlementId != null)
            .GroupBy(x => x.EntitlementId!.Value).ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.CreatedAt).First().AdminId);
        var revokeAdmins = audits.Where(x => x.Action == AdminAuditActionNames.RevokePackage && x.EntitlementId != null)
            .GroupBy(x => x.EntitlementId!.Value).ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.CreatedAt).First().AdminId);
        var actorIds = grantAdmins.Values.Concat(revokeAdmins.Values).Distinct().ToList();
        var names = actorIds.Count == 0 ? new Dictionary<Guid, string>() : await db.Organizers.IgnoreQueryFilters().AsNoTracking()
            .Where(x => actorIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name);
        return rows.Select(x => new AdminEntitlement(
            x.Id, x.PackageId, x.PackageCode, x.PackageName, x.Kind, x.Source, x.GrantedAt,
            grantAdmins.GetValueOrDefault(x.Id), names.GetValueOrDefault(grantAdmins.GetValueOrDefault(x.Id, Guid.Empty)),
            x.ExpiresAt, x.UsesRemaining, x.RevokedAt, revokeAdmins.GetValueOrDefault(x.Id), x.Note)).ToList();
    }
}
