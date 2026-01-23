using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using CherryPlayServer.Models;
using CherryPlayServer.Data;
using CherryPlayServer.Hubs;
using System.Text.Json;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/parties")]
public class PartiesController : ControllerBase
{
    private readonly InMemoryPartyStore _partyStore;
    private readonly IHubContext<PartyHub> _hubContext;
    private readonly ILogger<PartiesController> _logger;

    public PartiesController(InMemoryPartyStore partyStore, IHubContext<PartyHub> hubContext, ILogger<PartiesController> logger)
    {
        _partyStore = partyStore;
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpPost]
    public ActionResult<PartyDto> CreateParty([FromBody] CreatePartyDto dto)
    {
        var party = new Party
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            ShortCode = GenerateShortCode(),
            StyleId = dto.StyleId,
            CustomizationSettings = dto.CustomizationSettings,
            Playlist = dto.PlaylistData,
            CreatedAt = DateTime.UtcNow,
            EventDateTime = dto.EventDateTime
        };

        _partyStore.AddParty(party);

        var partyDto = new PartyDto
        {
            Id = party.Id.ToString(),
            Name = party.Name,
            ShortCode = party.ShortCode,
            StyleId = party.StyleId,
            CreatedAt = party.CreatedAt.ToString("O"),
            HasActiveSession = false,
            EventDateTime = party.EventDateTime?.ToString("O")
        };

        return Ok(partyDto);
    }

    /// <summary>
    /// Проверяет существование вечеринки по ID
    /// </summary>
    [HttpGet("{partyId}")]
    public ActionResult<PartyDto> GetParty(string partyId)
    {
        if (!Guid.TryParse(partyId, out var partyGuid))
        {
            return BadRequest("Invalid party ID format");
        }

        var party = _partyStore.GetPartyById(partyGuid);
        if (party == null)
        {
            return NotFound($"Party with ID {partyId} not found");
        }

        var state = _partyStore.GetSessionState(party.Id);
        var partyDto = new PartyDto
        {
            Id = party.Id.ToString(),
            Name = party.Name,
            ShortCode = party.ShortCode,
            StyleId = party.StyleId,
            CreatedAt = party.CreatedAt.ToString("O"),
            HasActiveSession = state != null,
            EventDateTime = party.EventDateTime?.ToString("O")
        };

        return Ok(partyDto);
    }

    /// <summary>
    /// Обновляет плейлист вечеринки и уведомляет всех зрителей через SignalR
    /// </summary>
    [HttpPut("{partyId}/playlist")]
    public async Task<ActionResult> UpdatePartyPlaylist(string partyId, [FromBody] PartyPlaylistDto playlist)
    {
        if (!Guid.TryParse(partyId, out var partyGuid))
        {
            return BadRequest("Invalid party ID format");
        }

        var party = _partyStore.GetPartyById(partyGuid);
        if (party == null)
        {
            return NotFound($"Party with ID {partyId} not found");
        }

        // Обновляем плейлист в хранилище
        party.Playlist = playlist;

        // Уведомляем всех зрителей через SignalR о необходимости обновить плейлист
        var groupName = partyGuid.ToString();
        _logger.LogInformation("[PartiesController] → Sending OnPlaylistChanged: partyId={PartyId}, group={Group}, itemsCount={ItemsCount}, totalTracks={TotalTracks}", 
            partyId, groupName, playlist.Items?.Count ?? 0, playlist.TotalTracks);
        await _hubContext.Clients.Group(groupName).SendAsync("OnPlaylistChanged", partyId);
        _logger.LogInformation("[PartiesController] ✓ OnPlaylistChanged sent successfully: partyId={PartyId}, group={Group}", 
            partyId, groupName);

        return NoContent();
    }

    private string GenerateShortCode()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var random = new Random();
        return new string(Enumerable.Repeat(chars, 6)
            .Select(s => s[random.Next(s.Length)]).ToArray());
    }
}

public class CreatePartyDto
{
    public string Name { get; set; } = string.Empty;
    public string StyleId { get; set; } = "cyberpunk";
    public Dictionary<string, object>? CustomizationSettings { get; set; }
    public PartyPlaylistDto PlaylistData { get; set; } = new();
    public DateTime? EventDateTime { get; set; }
}

public class PartyDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ShortCode { get; set; } = string.Empty;
    public string StyleId { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public bool HasActiveSession { get; set; }
    public string? EventDateTime { get; set; }
}

