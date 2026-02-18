using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Mappings;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Core.Services;

public class PartyService : IPartyService
{
    private readonly IPartyRepository _partyRepository;
    private readonly IStreamingRepository _streamingRepository;
    private readonly IShortCodeGenerator _shortCodeGenerator;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<PartyService> _logger;

    public PartyService(
        IPartyRepository partyRepository,
        IStreamingRepository streamingRepository,
        IShortCodeGenerator shortCodeGenerator,
        IHttpContextAccessor httpContextAccessor,
        ILogger<PartyService> logger)
    {
        _partyRepository = partyRepository ?? throw new ArgumentNullException(nameof(partyRepository));
        _streamingRepository = streamingRepository ?? throw new ArgumentNullException(nameof(streamingRepository));
        _shortCodeGenerator = shortCodeGenerator ?? throw new ArgumentNullException(nameof(shortCodeGenerator));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<PartyDto> CreatePartyAsync(CreatePartyDto dto)
    {
        if (dto == null)
        {
            throw new ArgumentNullException(nameof(dto));
        }

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            throw new ArgumentException("Party name cannot be null or empty", nameof(dto));
        }

        var organizerId = _httpContextAccessor.HttpContext?.GetOrganizerId();
        if (!organizerId.HasValue)
        {
            throw new UnauthorizedAccessException("Organizer ID is required to create a party");
        }

        _logger.LogInformation(
            "Creating party: name={Name}, themeId={ThemeId}, organizerId={OrganizerId}",
            dto.Name,
            dto.ThemeId,
            organizerId.Value);

        var shortCode = await _shortCodeGenerator.GenerateUniqueShortCodeAsync(
            async code => await _partyRepository.GetByShortCodeAsync(code) == null);

        var party = new Party
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizerId.Value,
            Name = dto.Name,
            ShortCode = shortCode,
            ThemeId = dto.ThemeId,
            CustomizationSettings = dto.CustomizationSettings,
            Playlist = dto.PlaylistData?.ToEntity() ?? new PartyPlaylist(),
            CreatedAt = DateTime.UtcNow,
            EventDateTime = dto.EventDateTime
        };

        await _partyRepository.AddAsync(party);

        _logger.LogInformation(
            "Party created: id={PartyId}, shortCode={ShortCode}, organizerId={OrganizerId}",
            party.Id,
            party.ShortCode,
            organizerId.Value);

        var state = await _streamingRepository.GetSessionStateAsync(party.Id);
        return party.ToDto(state != null);
    }

    public async Task<PartyDto?> GetPartyAsync(Guid partyId)
    {
        _logger.LogDebug("Getting party by id: {PartyId}", partyId);

        var party = await _partyRepository.GetByIdAsync(partyId);
        if (party == null)
        {
            _logger.LogDebug("Party not found: {PartyId}", partyId);
            return null;
        }

        // Если запрос от организатора, проверяем владение
        var organizerId = _httpContextAccessor.HttpContext?.GetOrganizerId();
        if (organizerId.HasValue)
        {
            await EnsurePartyOwnershipAsync(partyId, organizerId.Value);
        }

        var state = await _streamingRepository.GetSessionStateAsync(party.Id);
        return party.ToDto(state != null);
    }

    public async Task<PartyDto?> GetPartyByShortCodeAsync(string shortCode)
    {
        _logger.LogDebug("Getting party by shortCode: {ShortCode}", shortCode);

        var party = await _partyRepository.GetByShortCodeAsync(shortCode);
        if (party == null)
        {
            _logger.LogDebug("Party not found by shortCode: {ShortCode}", shortCode);
            return null;
        }

        var state = await _streamingRepository.GetSessionStateAsync(party.Id);
        return party.ToDto(state != null);
    }

    public async Task<List<PartyDto>> GetAllPartiesAsync()
    {
        _logger.LogDebug("Getting all parties");

        var parties = await _partyRepository.GetAllAsync();
        var sessionStates = await _streamingRepository.GetAllSessionStatesAsync();
        var stateLookup = sessionStates.ToDictionary(s => s.Key, s => s.Value);

        var dtos = new List<PartyDto>(parties.Count);
        foreach (var party in parties)
        {
            var hasActiveSession = stateLookup.ContainsKey(party.Id);
            dtos.Add(party.ToDto(hasActiveSession));
        }

        _logger.LogDebug("Found {Count} parties", dtos.Count);
        return dtos;
    }

    public async Task UpdatePartyPlaylistAsync(Guid partyId, PartyPlaylistDto playlist)
    {
        if (playlist == null)
        {
            throw new ArgumentNullException(nameof(playlist));
        }

        var organizerId = _httpContextAccessor.HttpContext?.GetOrganizerId();
        if (!organizerId.HasValue)
        {
            throw new UnauthorizedAccessException("Organizer ID is required to update playlist");
        }

        _logger.LogInformation(
            "Updating playlist for party: {PartyId}, totalTracks={TotalTracks}, organizerId={OrganizerId}",
            partyId,
            playlist.TotalTracks,
            organizerId.Value);

        // Проверяем владение перед обновлением
        await EnsurePartyOwnershipAsync(partyId, organizerId.Value);

        var party = await _partyRepository.GetByIdAsync(partyId);
        if (party == null)
        {
            _logger.LogWarning("Party not found for playlist update: {PartyId}", partyId);
            throw new PartyNotFoundException(partyId);
        }

        party.Playlist = playlist.ToEntity();
        await _partyRepository.UpdateAsync(party);

        _logger.LogInformation("Playlist updated for party: {PartyId}", partyId);
    }

    /// <summary>
    /// Проверяет, что вечеринка принадлежит указанному организатору
    /// </summary>
    private async Task EnsurePartyOwnershipAsync(Guid partyId, Guid organizerId)
    {
        var party = await _partyRepository.GetByIdAsync(partyId);
        if (party == null)
        {
            throw new PartyNotFoundException(partyId);
        }

        if (party.OrganizerId != organizerId)
        {
            _logger.LogWarning(
                "Access denied: party {PartyId} does not belong to organizer {OrganizerId}",
                partyId,
                organizerId);
            throw new UnauthorizedAccessException("You do not have permission to access this party");
        }
    }
}
