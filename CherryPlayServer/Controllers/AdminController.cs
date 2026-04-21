using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Core.Extensions;
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

        var entitlements = entitlementRows.Select(x => new EntitlementDto(
            x.Id,
            x.PackageId,
            x.PackageCode,
            x.PackageName,
            x.Kind,
            x.Source,
            x.GrantedAt,
            x.ExpiresAt,
            x.UsesRemaining,
            x.RevokedAt,
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
            Action = "grant_package",
            TargetOrganizerId = id,
            PackageId = body.PackageId,
            EntitlementId = entitlement.Id,
            Note = body.Note,
            CreatedAt = now
        });
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return StatusCode(201, new EntitlementDto(entitlement.Id, entitlement.PackageId, package.Code, package.Name, entitlement.Kind, entitlement.Source, entitlement.GrantedAt, entitlement.ExpiresAt, entitlement.UsesRemaining, entitlement.RevokedAt, entitlement.Note));
    }

    [HttpDelete("organizers/{id:guid}/entitlements/{entitlementId:guid}")]
    public async Task<ActionResult> Revoke(Guid id, Guid entitlementId, [FromBody] RevokeEntitlementRequest? body)
    {
        var entitlement = await _db.OrganizerEntitlements.FirstOrDefaultAsync(x => x.Id == entitlementId && x.OrganizerId == id);
        if (entitlement == null) return NotFound(new { code = "entitlement_not_found", message = "Entitlement not found" });
        if (entitlement.RevokedAt != null) return Conflict(new { code = "entitlement_already_revoked", message = "Entitlement already revoked" });

        var adminId = HttpContext.RequireOrganizerId();
        var now = DateTime.UtcNow;
        entitlement.RevokedAt = now;
        if (!string.IsNullOrWhiteSpace(body?.Note))
        {
            entitlement.Note = string.IsNullOrWhiteSpace(entitlement.Note)
                ? body.Note
                : $"{entitlement.Note}\n\n--- revoke: {now:O} ---\n{body.Note}";
        }

        await using var tx = await _db.Database.BeginTransactionAsync();
        _db.AdminAuditLogs.Add(new Infrastructure.Persistence.Entities.AdminAuditLogEf
        {
            Id = Guid.NewGuid(),
            AdminId = adminId,
            Action = "revoke_package",
            TargetOrganizerId = id,
            PackageId = entitlement.PackageId,
            EntitlementId = entitlement.Id,
            Note = body?.Note,
            CreatedAt = now
        });
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return NoContent();
    }
}
