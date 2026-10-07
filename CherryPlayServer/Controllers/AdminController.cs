using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/admin")]
[AuthorizeAdmin]
[EnableRateLimiting("admin-strict")]
public class AdminController : ControllerBase
{
    private readonly IAdminQueryService _queryService;
    private readonly IAdminEntitlementService _entitlementService;

    public AdminController(IAdminQueryService queryService, IAdminEntitlementService entitlementService)
    {
        _queryService = queryService;
        _entitlementService = entitlementService;
    }

    [HttpGet("theme-packages")]
    public async Task<ActionResult<AdminThemePackageListDto>> GetPackages()
    {
        var items = await _queryService.GetPackagesAsync();
        return Ok(new AdminThemePackageListDto(items.Select(x => new AdminThemePackageDto(x.Id, x.Code, x.Name, x.IsAutoGranted, x.IsActive, x.ThemeIds.ToList())).ToList()));
    }

    [HttpGet("organizers")]
    public async Task<ActionResult<AdminOrganizerListDto>> GetOrganizers([FromQuery] string? query, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _queryService.GetOrganizersAsync(query, page, pageSize);
        var items = result.Items.Select(x => new AdminOrganizerListItemDto(x.Id, x.Name, x.Email, x.OauthProviders.ToList(), x.Role, x.ActiveEntitlementsCount, x.CreatedAt)).ToList();
        return Ok(new AdminOrganizerListDto(items, result.Total, result.Page, result.PageSize));
    }

    [HttpGet("organizers/{id:guid}")]
    public async Task<ActionResult<AdminOrganizerDetailDto>> GetOrganizer(Guid id)
    {
        var organizer = await _queryService.GetOrganizerAsync(id);
        if (organizer is null) return NotFound(new { code = "organizer_not_found", message = "Organizer not found" });
        var oauth = organizer.OauthAccounts.Select(x => new AdminOauthAccountDto(x.Provider, x.ProviderUserId, x.ProviderUserName)).ToList();
        var entitlements = organizer.Entitlements.Select(ToDto).ToList();
        return Ok(new AdminOrganizerDetailDto(organizer.Id, organizer.Name, organizer.Email, oauth, organizer.Role, organizer.CreatedAt, entitlements));
    }

    [HttpGet("organizers/{id:guid}/entitlements")]
    public async Task<ActionResult<List<EntitlementDto>>> GetOrganizerEntitlements(Guid id, [FromQuery] string? status)
    {
        var organizerExists = await _queryService.OrganizerExistsAsync(id);
        if (!organizerExists) return NotFound(new { code = "organizer_not_found" });
        var activeOnly = string.Equals(status, "active", StringComparison.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(status) && !activeOnly && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            return ValidationProblem("status must be 'active' or 'all'.");
        }
        return Ok((await _queryService.GetOrganizerEntitlementsAsync(id, activeOnly)).Select(ToDto).ToList());
    }

    [HttpGet("entitlements/{entitlementId:guid}")]
    public async Task<ActionResult<EntitlementDto>> GetEntitlement(Guid entitlementId)
    {
        var entitlement = await _entitlementService.GetEntitlementAsync(entitlementId);
        return entitlement is null ? NotFound(new { code = "entitlement_not_found" }) : Ok(ToDto(entitlement));
    }

    [HttpGet("entitlement-revocations")]
    public async Task<ActionResult<List<EntitlementRevocationDto>>> GetRevocations([FromQuery] Guid entitlementId)
    {
        if (entitlementId == Guid.Empty) return ValidationProblem("entitlementId is required.");
        if (await _entitlementService.GetEntitlementAsync(entitlementId) is null)
        {
            return NotFound(new { code = "entitlement_not_found" });
        }
        var revocations = await _entitlementService.GetRevocationsAsync(entitlementId);
        return Ok(revocations.Select(ToDto).ToList());
    }

    [HttpGet("entitlement-revocations/{revocationId:guid}")]
    public async Task<ActionResult<EntitlementRevocationDto>> GetRevocation(Guid revocationId)
    {
        var revocation = await _entitlementService.GetRevocationByIdAsync(revocationId);
        return revocation is null ? NotFound(new { code = "revocation_not_found" }) : Ok(ToDto(revocation));
    }

    [HttpPost("entitlement-revocations")]
    public async Task<ActionResult<EntitlementRevocationDto>> CreateRevocation([FromBody] CreateEntitlementRevocationRequest body)
    {
        if (body.Id == Guid.Empty || body.EntitlementId == Guid.Empty) return ValidationProblem("id and entitlementId must be non-empty UUIDs.");
        var adminId = HttpContext.RequireOrganizerId();
        var result = await _entitlementService.RevokeAsync(body.EntitlementId, body.Id, adminId, body.Note);
        if (result.Kind == AdminEntitlementRevocationResultKind.EntitlementNotFound)
        {
            return NotFound(new { code = "entitlement_not_found" });
        }
        if (result.Kind == AdminEntitlementRevocationResultKind.AlreadyRevoked)
        {
            return Conflict(new { code = "entitlement_already_revoked" });
        }
        if (result.Kind == AdminEntitlementRevocationResultKind.EventIdConflict)
        {
            return Conflict(new { code = "revocation_id_conflict" });
        }

        var dto = ToDto(result.Revocation!);
        if (result.Kind == AdminEntitlementRevocationResultKind.AlreadyCreated)
        {
            return Ok(dto);
        }
        return CreatedAtAction(nameof(GetRevocation), new { revocationId = body.Id }, dto);
    }

    [HttpPost("organizers/{id:guid}/entitlements")]
    public async Task<ActionResult<EntitlementDto>> Grant(Guid id, [FromBody] GrantEntitlementRequest body)
    {
        var adminId = HttpContext.RequireOrganizerId();
        var result = await _entitlementService.GrantAsync(id, body.PackageId, adminId, body.Note);
        return result.Kind switch
        {
            AdminGrantResultKind.OrganizerNotFound => NotFound(new { code = "organizer_not_found", message = "Organizer not found" }),
            AdminGrantResultKind.PackageNotFound => NotFound(new { code = "package_not_found", message = "Package not found" }),
            AdminGrantResultKind.PackageAutoGranted => BadRequest(new { code = "package_is_auto_granted", message = "Cannot grant auto package" }),
            AdminGrantResultKind.AlreadyActive => Conflict(new { code = "entitlement_already_active", existingEntitlementId = result.Entitlement!.Id }),
            _ => CreatedAtAction(nameof(GetEntitlement), new { entitlementId = result.Entitlement!.Id }, ToDto(result.Entitlement))
        };
    }

    [HttpDelete("organizers/{id:guid}/entitlements/{entitlementId:guid}")]
    public async Task<ActionResult> Revoke(Guid id, Guid entitlementId, [FromBody] RevokeEntitlementRequest? body)
    {
        var adminId = HttpContext.RequireOrganizerId();
        var result = await _entitlementService.RevokeLegacyAsync(id, entitlementId, adminId, body?.Note);
        return result.Kind switch
        {
            AdminLegacyRevokeResultKind.EntitlementNotFound => NotFound(new { code = "entitlement_not_found", message = "Entitlement not found" }),
            AdminLegacyRevokeResultKind.AlreadyRevoked => Conflict(new { code = "entitlement_already_revoked", message = "Entitlement already revoked" }),
            _ => NoContent()
        };
    }

    private static EntitlementRevocationDto ToDto(CherryPlayServer.Core.Entities.EntitlementRevocation revocation)
    {
        return new EntitlementRevocationDto(revocation.Id, revocation.EntitlementId, revocation.AdminId, revocation.Note, revocation.CreatedAt);
    }

    private static EntitlementDto ToDto(CherryPlayServer.Core.Entities.AdminEntitlement entitlement)
    {
        return new EntitlementDto(entitlement.Id, entitlement.PackageId, entitlement.PackageCode, entitlement.PackageName, entitlement.Kind, entitlement.Source, entitlement.GrantedAt, entitlement.GrantedByAdminId, entitlement.GrantedByAdminName, entitlement.ExpiresAt, entitlement.UsesRemaining, entitlement.RevokedAt, entitlement.RevokedByAdminId, entitlement.Note);
    }
}
