using Microsoft.AspNetCore.Mvc;
using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Models;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/consent-events")]
public class ConsentEventsController : ControllerBase
{
    [HttpGet]
    [AuthorizeOrganizer]
    public ActionResult<List<ConsentEventDto>> List()
    {
        return Ok(new List<ConsentEventDto>());
    }

    [HttpPost]
    [AuthorizeOrganizer]
    public ActionResult<List<ConsentEventDto>> Create([FromBody] CreateConsentEventsRequest request)
    {
        if (request == null)
        {
            return BadRequest("Request body cannot be null");
        }

        var now = DateTimeOffset.UtcNow;
        var events = (request.Events ?? new List<ConsentInputDto>())
            .Select(e => new ConsentEventDto(
                e.Id,
                e.LegalDocumentVersionId,
                e.DocumentHash ?? string.Empty,
                e.Decision,
                now))
            .ToList();

        var location = events.Count > 0
            ? $"/api/consent-events/{events[0].Id}"
            : "/api/consent-events";
        return Created(location, events);
    }
}
