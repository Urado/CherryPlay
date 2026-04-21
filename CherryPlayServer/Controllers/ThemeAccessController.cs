using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Mvc;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/organizer/me/theme-access")]
public class ThemeAccessController : ControllerBase
{
    private readonly IThemeAccessService _themeAccessService;

    public ThemeAccessController(IThemeAccessService themeAccessService)
    {
        _themeAccessService = themeAccessService;
    }

    [HttpGet]
    [AuthorizeOrganizer]
    public async Task<ActionResult<ThemeAccessDto>> Get()
    {
        var organizerId = HttpContext.RequireOrganizerId();
        var summary = await _themeAccessService.GetAccessSummaryAsync(organizerId);
        return Ok(new ThemeAccessDto(
            summary.GrantedThemeIds,
            summary.VisibleLockedThemes.Select(x => new VisibleLockedThemeDto(x.ThemeId, x.PackageCode, x.PackageName)).ToList(),
            summary.ContactUrl));
    }
}
