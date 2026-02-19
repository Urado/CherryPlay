using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using CherryPlayServer.Models;
using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Extensions;
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
    [AuthorizeOrganizer]
    public async Task<ActionResult<PartyDto>> CreateParty([FromBody] CreatePartyDto dto)
    {
        if (HttpContext.GetOrganizerId() == null)
        {
            return Unauthorized("Требуется авторизация для создания вечеринки.");
        }

        if (dto == null)
        {
            return BadRequest("Request body cannot be null");
        }

        // Логирование для отладки
        if (dto.CustomizationSettings != null)
        {
            _logger.LogDebug("Received CustomizationSettings: {Settings}",
                System.Text.Json.JsonSerializer.Serialize(dto.CustomizationSettings));
            foreach (var kvp in dto.CustomizationSettings)
            {
                _logger.LogDebug("Key: {Key}, Value: {Value}, Type: {Type}",
                    kvp.Key, kvp.Value, kvp.Value?.GetType().Name ?? "null");
            }
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
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(403, ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating party");
            return StatusCode(500, "An error occurred while creating the party");
        }
    }

    /// <summary>
    /// Список вечеринок текущего организатора
    /// </summary>
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
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting organizer parties");
            return StatusCode(500, "An error occurred while retrieving parties");
        }
    }

    /// <summary>
    /// Проверяет существование вечеринки по ID
    /// </summary>
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
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting party: {PartyId}", partyId);
            return StatusCode(500, "An error occurred while retrieving the party");
        }
    }

    /// <summary>
    /// Обновляет метаданные вечеринки
    /// </summary>
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
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
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

    /// <summary>
    /// Удаляет вечеринку
    /// </summary>
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
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
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

    /// <summary>
    /// Обновляет плейлист вечеринки и уведомляет всех зрителей через SignalR
    /// </summary>
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

            var groupName = partyGuid.ToString();
            _logger.LogInformation("[PartiesController] -> Sending OnPlaylistChanged: partyId={PartyId}, group={Group}, itemsCount={ItemsCount}, totalTracks={TotalTracks}",
                partyId, groupName, playlist.Items?.Count ?? 0, playlist.TotalTracks);
            await _hubContext.Clients.Group(groupName).SendAsync("OnPlaylistChanged", partyId);
            _logger.LogInformation("[PartiesController] OnPlaylistChanged sent successfully: partyId={PartyId}, group={Group}",
                partyId, groupName);

            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
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
