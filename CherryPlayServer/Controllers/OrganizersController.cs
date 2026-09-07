using Microsoft.AspNetCore.Mvc;
using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Models;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/organizers")]
public class OrganizersController : ControllerBase
{
    [HttpPost]
    public ActionResult<RegisterOrganizerResponse> Register([FromBody] RegisterOrganizerRequest request)
    {
        if (request == null)
        {
            return BadRequest("Request body cannot be null");
        }

        var id = Guid.NewGuid();
        var response = new RegisterOrganizerResponse(
            id,
            request.Email ?? string.Empty,
            request.Name ?? string.Empty);

        return Created($"/api/organizers/{id}", response);
    }

    [HttpGet("{id:guid}/consent-events")]
    [AuthorizeOrganizer]
    public ActionResult<List<ConsentEventDto>> GetConsentEvents(Guid id)
    {
        var organizerId = HttpContext.RequireOrganizerId();
        if (id != organizerId)
        {
            return Forbid();
        }

        return Ok(new List<ConsentEventDto>());
    }
}
