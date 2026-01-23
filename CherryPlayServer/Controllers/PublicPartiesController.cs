using Microsoft.AspNetCore.Mvc;
using CherryPlayServer.Models;
using CherryPlayServer.Data;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/parties/public")]
public class PublicPartiesController : ControllerBase
{
    private readonly InMemoryPartyStore _partyStore;

    public PublicPartiesController(InMemoryPartyStore partyStore)
    {
        _partyStore = partyStore;
    }

    [HttpGet("first")]
    public ActionResult<PartyPlaylistDto> GetFirstPartyPlaylist()
    {
        var party = _partyStore.GetFirstParty();
        if (party == null)
        {
            return NotFound("No parties found");
        }

        return Ok(party.Playlist);
    }

    [HttpGet("{shortCode}")]
    public ActionResult<PublicPartyDto> GetPublicParty(string shortCode)
    {
        var party = _partyStore.GetPartyByShortCode(shortCode);
        if (party == null)
        {
            return NotFound("Party not found");
        }

        var dto = new PublicPartyDto
        {
            Id = party.Id.ToString(),
            Name = party.Name,
            StyleId = party.StyleId,
            CustomizationSettings = party.CustomizationSettings,
            HasActiveSession = _partyStore.GetSessionState(party.Id) != null
        };

        return Ok(dto);
    }

    [HttpGet("{shortCode}/playlist")]
    public ActionResult<PartyPlaylistDto> GetPartyPlaylist(string shortCode)
    {
        var party = _partyStore.GetPartyByShortCode(shortCode);
        if (party == null)
        {
            return NotFound("Party not found");
        }

        return Ok(party.Playlist);
    }

    /// <summary>
    /// Получает список всех публичных вечеринок
    /// </summary>
    [HttpGet("list")]
    public ActionResult<List<PublicPartyListItemDto>> GetAllParties()
    {
        var parties = _partyStore.GetAllParties();
        var dtos = parties.Select(party => new PublicPartyListItemDto
        {
            Id = party.Id.ToString(),
            Name = party.Name,
            ShortCode = party.ShortCode,
            StyleId = party.StyleId,
            HasActiveSession = _partyStore.GetSessionState(party.Id) != null,
            CreatedAt = party.CreatedAt.ToString("O"),
            TotalTracks = party.Playlist?.TotalTracks ?? 0,
            TotalDuration = party.Playlist?.TotalDuration ?? 0,
            EventDateTime = party.EventDateTime?.ToString("O"),
        }).ToList();

        return Ok(dtos);
    }
}

public class PublicPartyListItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ShortCode { get; set; } = string.Empty;
    public string StyleId { get; set; } = string.Empty;
    public bool HasActiveSession { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
    public int TotalTracks { get; set; }
    public int TotalDuration { get; set; }
    public string? EventDateTime { get; set; }
}
