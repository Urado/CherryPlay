using Microsoft.AspNetCore.Mvc;
using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/consent-events")]
public class ConsentEventsController : ControllerBase
{
    private readonly IConsentEventsService _consentEventsService;

    public ConsentEventsController(IConsentEventsService consentEventsService)
    {
        _consentEventsService = consentEventsService ?? throw new ArgumentNullException(nameof(consentEventsService));
    }

    [HttpGet]
    [AuthorizeOrganizer]
    public async Task<ActionResult<IReadOnlyList<ConsentEventDto>>> List(CancellationToken cancellationToken)
    {
        var organizerId = HttpContext.RequireOrganizerId();
        var events = await _consentEventsService.ListAsync(organizerId, cancellationToken);
        return Ok(events);
    }

    [HttpPost]
    [AuthorizeOrganizer]
    public async Task<ActionResult<IReadOnlyList<ConsentEventDto>>> Create(
        [FromBody] CreateConsentEventsRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest("Request body cannot be null");
        }

        var organizerId = HttpContext.RequireOrganizerId();
        var events = await _consentEventsService.CreateAsync(organizerId, request, cancellationToken);
        var location = events.Count > 0
            ? $"/api/consent-events/{events[0].Id}"
            : "/api/consent-events";
        return Created(location, events);
    }
}
