using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using CherryPlayServer.Models;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Hubs;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/parties")]
public class PartiesController : ControllerBase
{
    private readonly IPartyService _partyService;
    private readonly IHubContext<PartyHub> _hubContext;
    private readonly ILogger<PartiesController> _logger;

    public PartiesController(IPartyService partyService, IHubContext<PartyHub> hubContext, ILogger<PartiesController> logger)
    {
        _partyService = partyService ?? throw new ArgumentNullException(nameof(partyService));
        _hubContext = hubContext ?? throw new ArgumentNullException(nameof(hubContext));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpPost]
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
            return Ok(partyDto);
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

    /// <summary>
    /// Проверяет существование вечеринки по ID
    /// </summary>
    [HttpGet("{partyId}")]
    public async Task<ActionResult<PartyDto>> GetParty(string partyId)
    {
        if (string.IsNullOrWhiteSpace(partyId))
        {
            return BadRequest("Party ID cannot be empty");
        }

        if (!Guid.TryParse(partyId, out var partyGuid))
        {
            return BadRequest("Invalid party ID format");
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
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting party: {PartyId}", partyId);
            return StatusCode(500, "An error occurred while retrieving the party");
        }
    }

    /// <summary>
    /// Обновляет плейлист вечеринки и уведомляет всех зрителей через SignalR
    /// </summary>
    [HttpPut("{partyId}/playlist")]
    public async Task<ActionResult> UpdatePartyPlaylist(string partyId, [FromBody] PartyPlaylistDto playlist)
    {
        if (string.IsNullOrWhiteSpace(partyId))
        {
            return BadRequest("Party ID cannot be empty");
        }

        if (!Guid.TryParse(partyId, out var partyGuid))
        {
            return BadRequest("Invalid party ID format");
        }

        if (playlist == null)
        {
            return BadRequest("Playlist cannot be null");
        }

        try
        {
            await _partyService.UpdatePartyPlaylistAsync(partyGuid, playlist);

            var groupName = partyGuid.ToString();
            _logger.LogInformation("[PartiesController] -> Sending OnPlaylistChanged: partyId={PartyId}, group={Group}, itemsCount={ItemsCount}, totalTracks={TotalTracks}",
                partyId, groupName, playlist.Items?.Count ?? 0, playlist.TotalTracks);
            await _hubContext.Clients.Group(groupName).SendAsync("OnPlaylistChanged", partyId);
            _logger.LogInformation("[PartiesController] OnPlaylistChanged sent successfully: partyId={PartyId}, group={Group}",
                partyId, groupName);

            return NoContent();
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
}
