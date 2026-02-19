using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CherryPlayServer.Models;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Extensions;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/parties/public")]
[EnableRateLimiting("public")]
public class PublicPartiesController : ControllerBase
{
    private readonly IPublicPartyQueryService _publicPartyQueryService;
    private readonly IStreamingService _streamingService;
    private readonly ILogger<PublicPartiesController> _logger;

    public PublicPartiesController(
        IPublicPartyQueryService publicPartyQueryService,
        IStreamingService streamingService,
        ILogger<PublicPartiesController> logger)
    {
        _publicPartyQueryService = publicPartyQueryService ?? throw new ArgumentNullException(nameof(publicPartyQueryService));
        _streamingService = streamingService ?? throw new ArgumentNullException(nameof(streamingService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpGet("first")]
    public async Task<ActionResult<PartyPlaylistDto>> GetFirstPartyPlaylist()
    {
        var playlist = await _publicPartyQueryService.GetFirstPartyPlaylistAsync();
        if (playlist == null)
        {
            return NotFound("No parties found");
        }

        return Ok(playlist);
    }

    [HttpGet("{shortCode}")]
    public async Task<ActionResult<PublicPartyDto>> GetPublicParty(string shortCode)
    {
        if (string.IsNullOrWhiteSpace(shortCode))
        {
            return BadRequest("Short code cannot be empty");
        }

        try
        {
            var party = await _publicPartyQueryService.GetPublicPartyAsync(shortCode);
            if (party == null)
            {
                return NotFound("Party not found");
            }

            return Ok(party);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid argument for GetPublicParty: shortCode={ShortCode}", shortCode);
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving public party: shortCode={ShortCode}", shortCode);
            return StatusCode(500, "An error occurred while retrieving the party");
        }
    }

    [HttpGet("{shortCode}/playlist")]
    public async Task<ActionResult<PartyPlaylistDto>> GetPartyPlaylist(string shortCode)
    {
        if (string.IsNullOrWhiteSpace(shortCode))
        {
            return BadRequest("Short code cannot be empty");
        }

        try
        {
            var playlist = await _publicPartyQueryService.GetPartyPlaylistByShortCodeAsync(shortCode);
            if (playlist == null)
            {
                return NotFound("Party not found");
            }

            return Ok(playlist);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid argument for GetPartyPlaylist: shortCode={ShortCode}", shortCode);
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving playlist: shortCode={ShortCode}", shortCode);
            return StatusCode(500, "An error occurred while retrieving the playlist");
        }
    }

    /// <summary>
    /// Получает полное состояние вечеринки (плейлист + сессия)
    /// </summary>
    [HttpGet("{shortCode}/state")]
    public async Task<ActionResult<PartyStateDto>> GetPartyState(string shortCode)
    {
        if (string.IsNullOrWhiteSpace(shortCode))
        {
            return BadRequest("Short code cannot be empty");
        }

        try
        {
            var state = await _streamingService.GetPartyStateAsync(shortCode);
            if (state == null)
            {
                return NotFound("Party not found");
            }

            return Ok(state);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid argument for GetPartyState: shortCode={ShortCode}", shortCode);
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving party state: shortCode={ShortCode}", shortCode);
            return StatusCode(500, "An error occurred while retrieving the party state");
        }
    }

    /// <summary>
    /// Получает список всех публичных вечеринок
    /// </summary>
    [HttpGet("list")]
    public async Task<ActionResult<List<PublicPartyListItemDto>>> GetAllParties()
    {
        try
        {
            var parties = await _publicPartyQueryService.GetAllPublicPartiesAsync();
            return Ok(parties);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving all public parties");
            return StatusCode(500, "An error occurred while retrieving the parties");
        }
    }
}
