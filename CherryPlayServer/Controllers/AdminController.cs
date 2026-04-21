using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Queries;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using System.Data;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/admin")]
[AuthorizeAdmin]
[EnableRateLimiting("admin-strict")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("theme-packages")]
    public async Task<ActionResult<AdminThemePackageListDto>> GetPackages()
    {
        var items = await _db.ThemePackages.AsNoTracking().Include(x => x.Items).OrderBy(x => x.Code)
            .Select(x => new AdminThemePackageDto(x.Id, x.Code, x.Name, x.IsAutoGranted, x.IsActive, x.Items.Select(i => i.ThemeId).OrderBy(i => i).ToList()))
            .ToListAsync();
        return Ok(new AdminThemePackageListDto(items));
    }

    [HttpGet("organizers")]
    public async Task<ActionResult<AdminOrganizerListDto>> GetOrganizers([FromQuery] string? query, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var organizers = _db.Organizers.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(query))
        {
            var q = $"%{query.Trim()}%";
            var organizerIdsByEmail = _db.EmailAccounts.AsNoTracking()
                .Where(email => EF.Functions.ILike(email.Email, q))
                .Select(email => email.OrganizerId)
                .Distinct();
            organizers = organizers.Where(x =>
                EF.Functions.ILike(x.Name, q) ||
                organizerIdsByEmail.Contains(x.Id));
        }

        var now = DateTime.UtcNow;
        var activeEntitlementFilter = OrganizerEntitlementPredicates.IsActive(now);

        var total = await organizers.CountAsync();
        var organizerPage = await organizers
            .OrderBy(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new { x.Id, x.Name, x.Role, x.CreatedAt })
            .ToListAsync();

        var organizerIds = organizerPage.Select(x => x.Id).ToList();
        if (organizerIds.Count == 0)
        {
            return Ok(new AdminOrganizerListDto([], total, page, pageSize));
        }

        var emailsByOrganizer = await _db.EmailAccounts.AsNoTracking()
            .Where(x => organizerIds.Contains(x.OrganizerId))
            .GroupBy(x => x.OrganizerId)
            .Select(g => new
            {
                OrganizerId = g.Key,
                Email = g.OrderBy(x => x.CreatedAt).Select(x => x.Email).FirstOrDefault()
            })
            .ToDictionaryAsync(x => x.OrganizerId, x => x.Email);

        var oauthProvidersByOrganizer = await _db.OAuthAccounts.AsNoTracking()
            .Where(x => organizerIds.Contains(x.OrganizerId))
            .Select(x => new { x.OrganizerId, x.Provider })
            .Distinct()
            .ToListAsync();

        var oauthProviderMap = oauthProvidersByOrganizer
            .GroupBy(x => x.OrganizerId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => x.Provider).OrderBy(x => x).ToList());

        var activeEntitlementCounts = await _db.OrganizerEntitlements.AsNoTracking()
            .Where(activeEntitlementFilter)
            .Where(x => organizerIds.Contains(x.OrganizerId))
            .GroupBy(x => x.OrganizerId)
            .Select(g => new { OrganizerId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.OrganizerId, x => x.Count);

        var items = organizerPage.Select(x => new AdminOrganizerListItemDto(
            x.Id,
            x.Name,
            emailsByOrganizer.GetValueOrDefault(x.Id),
            oauthProviderMap.GetValueOrDefault(x.Id, []),
            x.Role,
            activeEntitlementCounts.GetValueOrDefault(x.Id),
            x.CreatedAt))
            .ToList();

        return Ok(new AdminOrganizerListDto(items, total, page, pageSize));
    }

    [HttpGet("organizers/{id:guid}")]
    public async Task<ActionResult<AdminOrganizerDetailDto>> GetOrganizer(Guid id)
    {
        var organizer = await _db.Organizers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (organizer == null) return NotFound(new { code = "organizer_not_found", message = "Organizer not found" });

        var email = await _db.EmailAccounts.AsNoTracking()
            .Where(x => x.OrganizerId == id)
            .OrderBy(x => x.CreatedAt)
            .Select(x => x.Email)
            .FirstOrDefaultAsync();

        var oauthAccounts = await _db.OAuthAccounts.AsNoTracking()
            .Where(x => x.OrganizerId == id)
            .OrderBy(x => x.Provider)
            .Select(x => new AdminOauthAccountDto(x.Provider, x.ProviderUserId, x.ProviderUserName))
            .ToListAsync();

        var entitlementRows = await _db.OrganizerEntitlements.AsNoTracking()
            .Where(x => x.OrganizerId == id)
            .Join(_db.ThemePackages, x => x.PackageId, p => p.Id, (x, p) => new
            {
                x.Id,
                x.PackageId,
                PackageCode = p.Code,
                PackageName = p.Name,
                x.Kind,
                x.Source,
                x.GrantedAt,
                x.ExpiresAt,
                x.UsesRemaining,
                x.RevokedAt,
                x.Note
            })
            .OrderByDescending(x => x.GrantedAt)
            .ToListAsync();

        var entitlementIds = entitlementRows.Select(x => x.Id).ToList();
        var auditRows = entitlementIds.Count == 0
            ? []
            : await _db.AdminAuditLogs.AsNoTracking()
                .Where(x => x.EntitlementId != null && entitlementIds.Contains(x.EntitlementId.Value))
                .Where(x => x.Action == AdminAuditActionNames.GrantPackage || x.Action == AdminAuditActionNames.RevokePackage)
                .Select(x => new { x.EntitlementId, x.AdminId, x.Action, x.CreatedAt })
                .ToListAsync();

        var grantByEntitlement = auditRows
            .Where(x => x.Action == AdminAuditActionNames.GrantPackage && x.EntitlementId != null)
            .GroupBy(x => x.EntitlementId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.CreatedAt).First().AdminId);

        var revokeByEntitlement = auditRows
            .Where(x => x.Action == AdminAuditActionNames.RevokePackage && x.EntitlementId != null)
            .GroupBy(x => x.EntitlementId!.Value)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.CreatedAt).First().AdminId);

        var adminIds = grantByEntitlement.Values
            .Concat(revokeByEntitlement.Values)
            .Distinct()
            .ToList();
        var adminNames = adminIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.Organizers.AsNoTracking()
                .Where(x => adminIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.Name);

        var entitlements = entitlementRows.Select(x => new EntitlementDto(
            x.Id,
            x.PackageId,
            x.PackageCode,
            x.PackageName,
            x.Kind,
            x.Source,
            x.GrantedAt,
            grantByEntitlement.GetValueOrDefault(x.Id),
            adminNames.GetValueOrDefault(grantByEntitlement.GetValueOrDefault(x.Id, Guid.Empty)),
            x.ExpiresAt,
            x.UsesRemaining,
            x.RevokedAt,
            revokeByEntitlement.GetValueOrDefault(x.Id),
            x.Note)).ToList();

        return Ok(new AdminOrganizerDetailDto(organizer.Id, organizer.Name, email, oauthAccounts, organizer.Role, organizer.CreatedAt, entitlements));
    }

    [HttpPost("organizers/{id:guid}/entitlements")]
    public async Task<ActionResult<EntitlementDto>> Grant(Guid id, [FromBody] GrantEntitlementRequest body)
    {
        var organizer = await _db.Organizers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (organizer == null) return NotFound(new { code = "organizer_not_found", message = "Organizer not found" });
        var package = await _db.ThemePackages.AsNoTracking().FirstOrDefaultAsync(x => x.Id == body.PackageId && x.IsActive);
        if (package == null) return NotFound(new { code = "package_not_found", message = "Package not found" });
        if (package.IsAutoGranted) return BadRequest(new { code = "package_is_auto_granted", message = "Cannot grant auto package" });

        var adminId = HttpContext.RequireOrganizerId();
        await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var now = DateTime.UtcNow;
        var active = await _db.OrganizerEntitlements.AsNoTracking()
            .Where(OrganizerEntitlementPredicates.IsActive(now))
            .FirstOrDefaultAsync(x => x.OrganizerId == id && x.PackageId == body.PackageId);
        if (active != null) return Conflict(new { code = "entitlement_already_active", existingEntitlementId = active.Id });

        var entitlement = new Infrastructure.Persistence.Entities.OrganizerEntitlementEf
        {
            Id = Guid.NewGuid(),
            OrganizerId = id,
            PackageId = body.PackageId,
            Kind = "lifetime",
            Source = "admin_grant",
            GrantedAt = now,
            Note = body.Note
        };
        _db.OrganizerEntitlements.Add(entitlement);
        _db.AdminAuditLogs.Add(new Infrastructure.Persistence.Entities.AdminAuditLogEf
        {
            Id = Guid.NewGuid(),
            AdminId = adminId,
            Action = AdminAuditActionNames.GrantPackage,
            TargetOrganizerId = id,
            PackageId = body.PackageId,
            EntitlementId = entitlement.Id,
            Note = body.Note,
            CreatedAt = now
        });
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        var admin = await _db.Organizers.AsNoTracking()
            .Where(x => x.Id == adminId)
            .Select(x => x.Name)
            .FirstOrDefaultAsync();

        return StatusCode(201, new EntitlementDto(
            entitlement.Id,
            entitlement.PackageId,
            package.Code,
            package.Name,
            entitlement.Kind,
            entitlement.Source,
            entitlement.GrantedAt,
            adminId,
            admin,
            entitlement.ExpiresAt,
            entitlement.UsesRemaining,
            entitlement.RevokedAt,
            null,
            entitlement.Note));
    }

    [HttpDelete("organizers/{id:guid}/entitlements/{entitlementId:guid}")]
    public async Task<ActionResult> Revoke(Guid id, Guid entitlementId, [FromBody] RevokeEntitlementRequest? body)
    {
        var adminId = HttpContext.RequireOrganizerId();
        var now = DateTime.UtcNow;
        await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var rowsUpdated = await TryAtomicRevokeAsync(id, entitlementId, now, body?.Note);

        if (rowsUpdated == 0)
        {
            await tx.RollbackAsync();
            var currentState = await _db.OrganizerEntitlements.AsNoTracking()
                .Where(x => x.Id == entitlementId && x.OrganizerId == id)
                .Select(x => new { x.RevokedAt })
                .FirstOrDefaultAsync();

            if (currentState == null)
            {
                return NotFound(new { code = "entitlement_not_found", message = "Entitlement not found" });
            }

            return Conflict(new { code = "entitlement_already_revoked", message = "Entitlement already revoked" });
        }

        var packageId = await _db.OrganizerEntitlements.AsNoTracking()
            .Where(x => x.Id == entitlementId && x.OrganizerId == id)
            .Select(x => x.PackageId)
            .SingleAsync();

        // Race-hardening invariant: a successful revoke must commit state change and audit record atomically.
        _db.AdminAuditLogs.Add(new Infrastructure.Persistence.Entities.AdminAuditLogEf
        {
            Id = Guid.NewGuid(),
            AdminId = adminId,
            Action = AdminAuditActionNames.RevokePackage,
            TargetOrganizerId = id,
            PackageId = packageId,
            EntitlementId = entitlementId,
            Note = body?.Note,
            CreatedAt = now
        });
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return NoContent();
    }

    private async Task<int> TryAtomicRevokeAsync(Guid organizerId, Guid entitlementId, DateTime now, string? revokeNote)
    {
        var providerName = _db.Database.ProviderName;

        if (_db.Database.IsNpgsql())
        {
            if (string.IsNullOrWhiteSpace(revokeNote))
            {
                return await _db.Database.ExecuteSqlInterpolatedAsync($"""
                    UPDATE organizer_entitlements
                    SET revoked_at = {now}
                    WHERE id = {entitlementId} AND organizer_id = {organizerId} AND revoked_at IS NULL
                    """);
            }

            var separator = $"\n\n--- revoke: {now:O} ---\n";
            return await _db.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE organizer_entitlements
                SET revoked_at = {now},
                    note = CASE
                        WHEN note IS NULL OR btrim(note) = '' THEN {revokeNote}
                        ELSE note || {separator} || {revokeNote}
                    END
                WHERE id = {entitlementId} AND organizer_id = {organizerId} AND revoked_at IS NULL
                """);
        }

        if (_db.Database.IsRelational())
        {
            var hasRevokeNote = !string.IsNullOrWhiteSpace(revokeNote);
            var separator = hasRevokeNote ? $"\n\n--- revoke: {now:O} ---\n" : null;
            var baseQuery = _db.OrganizerEntitlements
                .Where(x => x.Id == entitlementId && x.OrganizerId == organizerId && x.RevokedAt == null);

            if (!hasRevokeNote)
            {
                return await baseQuery.ExecuteUpdateAsync(
                    updates => updates.SetProperty(x => x.RevokedAt, _ => now));
            }

            var safeNote = revokeNote!;
            var safeSeparator = separator!;
            var replaceRows = await baseQuery
                .Where(x => x.Note == null || x.Note.Trim() == string.Empty)
                .ExecuteUpdateAsync(
                    updates => updates
                        .SetProperty(x => x.RevokedAt, _ => now)
                        .SetProperty(x => x.Note, _ => safeNote));

            if (replaceRows > 0)
            {
                return replaceRows;
            }

            return await baseQuery.ExecuteUpdateAsync(
                updates => updates
                    .SetProperty(x => x.RevokedAt, _ => now)
                    .SetProperty(
                        x => x.Note,
                        x => x.Note + safeSeparator + safeNote));
        }

        if (!string.Equals(providerName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"Non-relational revoke fallback is only supported for tests with InMemory provider. Current provider: {providerName ?? "<unknown>"}.");
        }

        var trackedEntitlement = await _db.OrganizerEntitlements.FirstOrDefaultAsync(x => x.Id == entitlementId && x.OrganizerId == organizerId);
        if (trackedEntitlement == null || trackedEntitlement.RevokedAt != null)
        {
            return 0;
        }

        trackedEntitlement.RevokedAt = now;
        if (!string.IsNullOrWhiteSpace(revokeNote))
        {
            trackedEntitlement.Note = string.IsNullOrWhiteSpace(trackedEntitlement.Note)
                ? revokeNote
                : $"{trackedEntitlement.Note}\n\n--- revoke: {now:O} ---\n{revokeNote}";
        }

        return 1;
    }
}
