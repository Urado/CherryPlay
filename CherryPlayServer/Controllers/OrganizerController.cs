using Microsoft.AspNetCore.Mvc;
using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/organizer")]
public class OrganizerController : ControllerBase
{
    private readonly IOrganizerService _organizerService;
    private readonly ILogger<OrganizerController> _logger;

    public OrganizerController(IOrganizerService organizerService, ILogger<OrganizerController> logger)
    {
        _organizerService = organizerService ?? throw new ArgumentNullException(nameof(organizerService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpGet("session/check")]
    [AuthorizeOrganizer]
    public ActionResult<object> CheckSession()
    {
        var organizerId = HttpContext.RequireOrganizerId();
        return Ok(new { valid = true, organizerId });
    }

    [HttpGet("me")]
    [AuthorizeOrganizer]
    public async Task<ActionResult<OrganizerDto>> GetMe()
    {
        var organizerId = HttpContext.RequireOrganizerId();
        var dto = await _organizerService.GetByIdAsync(organizerId);
        if (dto == null)
        {
            return NotFound("Organizer not found");
        }

        return Ok(dto);
    }

    [HttpPatch("profile")]
    [AuthorizeOrganizer]
    public async Task<ActionResult<OrganizerDto>> UpdateProfile([FromBody] UpdateOrganizerDto dto)
    {
        if (dto == null)
        {
            return BadRequest("Request body cannot be null");
        }

        var organizerId = HttpContext.RequireOrganizerId();
        try
        {
            var updated = await _organizerService.UpdateProfileAsync(organizerId, dto);
            if (updated == null)
            {
                return NotFound("Organizer not found");
            }

            return Ok(updated);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating organizer profile: {OrganizerId}", organizerId);
            return StatusCode(500, "An error occurred while updating organizer profile");
        }
    }
}
