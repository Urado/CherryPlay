using Microsoft.AspNetCore.Mvc;
using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/organizers")]
public class OrganizersController : ControllerBase
{
    private readonly IOrganizersService _organizersService;
    private readonly IConsentEventsService _consentEventsService;

    public OrganizersController(
        IOrganizersService organizersService,
        IConsentEventsService consentEventsService)
    {
        _organizersService = organizersService ?? throw new ArgumentNullException(nameof(organizersService));
        _consentEventsService = consentEventsService ?? throw new ArgumentNullException(nameof(consentEventsService));
    }

    [HttpPost]
    public async Task<ActionResult<RegisterOrganizerResponse>> Register(
        [FromBody] RegisterOrganizerRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest("Request body cannot be null");
        }

        var response = await _organizersService.RegisterAsync(request, cancellationToken);
        return Created($"/api/organizers/{response.Id}", response);
    }

    [HttpGet("{id:guid}/consent-events")]
    [AuthorizeOrganizer]
    public async Task<ActionResult<IReadOnlyList<ConsentEventDto>>> GetConsentEvents(
        Guid id,
        CancellationToken cancellationToken)
    {
        var organizerId = HttpContext.RequireOrganizerId();
        if (id != organizerId)
        {
            return Forbid();
        }

        var events = await _consentEventsService.ListAsync(id, cancellationToken);
        return Ok(events);
    }
}
