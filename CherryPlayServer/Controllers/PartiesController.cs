using Microsoft.AspNetCore.Mvc;
using CherryPlayServer.Models;
using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Extensions;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/parties")]
public class PartiesController : ControllerBase
{
    private readonly IPartyService _partyService;
    private readonly ILogger<PartiesController> _logger;

    public PartiesController(IPartyService partyService, ILogger<PartiesController> logger)
    {
        _partyService = partyService ?? throw new ArgumentNullException(nameof(partyService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpPost]
    [AuthorizeOrganizer]
    public async Task<ActionResult<PartyDto>> CreateParty([FromBody] CreatePartyDto dto)
    {
        if (dto == null)
        {
            return BadRequest("Request body cannot be null");
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var partyDto = await _partyService.CreatePartyAsync(dto);
            _logger.LogInformation("Party created successfully: id={PartyId}, shortCode={ShortCode}",
                partyDto.Id, partyDto.ShortCode);
            return Ok(partyDto);
        }
        catch (ThemeNotEntitledException ex)
        {
            return StatusCode(403, new { code = "theme_not_entitled", message = "Theme is not entitled", themeId = ex.ThemeId, requiredPackageCodes = ex.RequiredPackageCodes });
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(403, new { code = "forbidden", message = ex.Message });
        }
        catch (PartyLimitReachedException ex)
        {
            return StatusCode(403, ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating party");
            return StatusCode(500, "An error occurred while creating the party");
        }
    }

    [HttpGet]
    [AuthorizeOrganizer]
    public async Task<ActionResult<List<PartyDto>>> GetMyParties()
    {
        try
        {
            var parties = await _partyService.GetPartiesByOrganizerAsync();
            _logger.LogDebug("Returning {Count} parties for organizer", parties.Count);
            return Ok(parties);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting organizer parties");
            return StatusCode(500, "An error occurred while retrieving parties");
        }
    }

    [HttpGet("{partyId}")]
    [AuthorizeOrganizer]
    public async Task<ActionResult<PartyDto>> GetParty(string partyId)
    {
        if (!PartyIdExtensions.TryParsePartyId(partyId, out var partyGuid, out var errorResult))
        {
            return errorResult!;
        }

        try
        {
            var partyDto = await _partyService.GetPartyAsync(partyGuid);
            if (partyDto == null)
            {
                return NotFound($"Party with ID {partyId} not found");
            }

            return Ok(partyDto);
        }
        catch (ThemeNotEntitledException ex)
        {
            return StatusCode(403, new { code = "theme_not_entitled", message = "Theme is not entitled", themeId = ex.ThemeId, requiredPackageCodes = ex.RequiredPackageCodes });
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(403, new { code = "forbidden", message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting party: {PartyId}", partyId);
            return StatusCode(500, "An error occurred while retrieving the party");
        }
    }

    [HttpPut("{partyId}")]
    [AuthorizeOrganizer]
    public async Task<ActionResult> UpdatePartyMetadata(string partyId, [FromBody] UpdatePartyDto dto)
    {
        if (!PartyIdExtensions.TryParsePartyId(partyId, out var partyGuid, out var errorResult))
        {
            return errorResult!;
        }

        if (dto == null)
        {
            return BadRequest("Request body cannot be null");
        }

        try
        {
            await _partyService.UpdatePartyMetadataAsync(partyGuid, dto);
            return NoContent();
        }
        catch (ThemeNotEntitledException ex)
        {
            return StatusCode(403, new { code = "theme_not_entitled", message = "Theme is not entitled", themeId = ex.ThemeId, requiredPackageCodes = ex.RequiredPackageCodes });
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(403, new { code = "forbidden", message = ex.Message });
        }
        catch (PartyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating party metadata: {PartyId}", partyId);
            return StatusCode(500, "An error occurred while updating the party");
        }
    }

    [HttpDelete("{partyId}")]
    [AuthorizeOrganizer]
    public async Task<ActionResult> DeleteParty(string partyId)
    {
        if (!PartyIdExtensions.TryParsePartyId(partyId, out var partyGuid, out var errorResult))
        {
            return errorResult!;
        }

        try
        {
            await _partyService.DeletePartyAsync(partyGuid);
            return NoContent();
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(403, new { code = "forbidden", message = ex.Message });
        }
        catch (PartyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting party: {PartyId}", partyId);
            return StatusCode(500, "An error occurred while deleting the party");
        }
    }

    [HttpPut("{partyId}/playlist")]
    [AuthorizeOrganizer]
    public async Task<ActionResult> UpdatePartyPlaylist(string partyId, [FromBody] PartyPlaylistDto playlist)
    {
        if (!PartyIdExtensions.TryParsePartyId(partyId, out var partyGuid, out var errorResult))
        {
            return errorResult!;
        }

        if (playlist == null)
        {
            return BadRequest("Playlist cannot be null");
        }

        try
        {
            await _partyService.UpdatePartyPlaylistAsync(partyGuid, playlist);
            return NoContent();
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(403, new { code = "forbidden", message = ex.Message });
        }
        catch (PartyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating playlist for party: {PartyId}", partyId);
            return StatusCode(500, "An error occurred while updating the playlist");
        }
    }

    [HttpPost("{partyId}/lifecycle")]
    [AuthorizeOrganizer]
    public async Task<ActionResult<PartyDto>> TransitionPartyLifecycle(
        string partyId,
        [FromBody] TransitionPartyLifecycleDto dto)
    {
        if (!PartyIdExtensions.TryParsePartyId(partyId, out var partyGuid, out var errorResult))
        {
            return errorResult!;
        }

        if (dto == null)
        {
            return BadRequest("Request body cannot be null");
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var partyDto = await _partyService.TransitionPartyLifecycleAsync(partyGuid, dto.PartyLifecycleState);
            return Ok(partyDto);
        }
        catch (ForbiddenException ex)
        {
            return StatusCode(403, new { code = "forbidden", message = ex.Message });
        }
        catch (PartyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidPartyLifecycleTransitionException ex)
        {
            return Conflict(new
            {
                code = "invalid_lifecycle_transition",
                message = ex.Message,
                currentState = ex.CurrentState,
                requestedState = ex.RequestedState,
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error transitioning party lifecycle: {PartyId}", partyId);
            return StatusCode(500, "An error occurred while updating party lifecycle state");
        }
    }
}
