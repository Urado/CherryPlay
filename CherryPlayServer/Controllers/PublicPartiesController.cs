using Microsoft.AspNetCore.Mvc;
using CherryPlayServer.Models;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/parties/public")]
public class PublicPartiesController : ControllerBase
{
    private readonly IPublicPartyQueryService _publicPartyQueryService;

    public PublicPartiesController(IPublicPartyQueryService publicPartyQueryService)
    {
        _publicPartyQueryService = publicPartyQueryService ?? throw new ArgumentNullException(nameof(publicPartyQueryService));
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
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
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
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            return StatusCode(500, "An error occurred while retrieving the playlist");
        }
    }

    /// <summary>
    /// Получает список всех публичных вечеринок
    /// </summary>
    [HttpGet("list")]
    public async Task<ActionResult<List<PublicPartyListItemDto>>> GetAllParties()
    {
        var parties = await _publicPartyQueryService.GetAllPublicPartiesAsync();
        return Ok(parties);
    }
}
