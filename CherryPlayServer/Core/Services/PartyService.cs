using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Mappings;
using CherryPlayServer.Core.Validators;
using CherryPlayServer.Core;
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
    private readonly IPartyPlaylistNotifier _playlistNotifier;
    private readonly IPartyAccessService _partyAccessService;
    private readonly ILogger<PartyService> _logger;

    public PartyService(
        IPartyRepository partyRepository,
        IStreamingRepository streamingRepository,
        IShortCodeGenerator shortCodeGenerator,
        IHttpContextAccessor httpContextAccessor,
        IPartyPlaylistNotifier playlistNotifier,
        IPartyAccessService partyAccessService,
        ILogger<PartyService> logger)
    {
        _partyRepository = partyRepository ?? throw new ArgumentNullException(nameof(partyRepository));
        _streamingRepository = streamingRepository ?? throw new ArgumentNullException(nameof(streamingRepository));
        _shortCodeGenerator = shortCodeGenerator ?? throw new ArgumentNullException(nameof(shortCodeGenerator));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
        _playlistNotifier = playlistNotifier ?? throw new ArgumentNullException(nameof(playlistNotifier));
        _partyAccessService = partyAccessService ?? throw new ArgumentNullException(nameof(partyAccessService));
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

        var normalizedSettings = CustomizationSettingsValidator.NormalizeCustomizationSettings(dto.CustomizationSettings);

        if (normalizedSettings != null && !CustomizationSettingsValidator.IsValidCustomizationSettings(normalizedSettings))
        {
            throw new ArgumentException("CustomizationSettings must contain only string or number values", nameof(dto));
        }

        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext == null)
        {
            throw new UnauthorizedAccessException("HTTP context is required");
        }
        var organizerId = httpContext.RequireOrganizerId("create a party");

        _logger.LogInformation(
            "Creating party: name={Name}, themeId={ThemeId}, organizerId={OrganizerId}",
            dto.Name,
            dto.ThemeId,
            organizerId);

        var myParties = await _partyRepository.GetByOrganizerIdAsync(organizerId);
        var futureCount = myParties.Count(p => p.EventDateTime.HasValue && p.EventDateTime.Value > DateTime.UtcNow);
        if (futureCount >= AuthConstants.MaxFuturePartiesPerOrganizer)
        {
            throw new PartyLimitReachedException(
                $"Limit of {AuthConstants.MaxFuturePartiesPerOrganizer} future parties per organizer reached.");
        }

        var shortCode = await _shortCodeGenerator.GenerateUniqueShortCodeAsync(
            async code => await _partyRepository.GetByShortCodeAsync(code) == null);

        var party = new Party
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizerId,
            Name = dto.Name,
            ShortCode = shortCode,
            ThemeId = dto.ThemeId,
            CustomizationSettings = normalizedSettings,
            Playlist = dto.PlaylistData?.ToEntity() ?? new PartyPlaylist(),
            CreatedAt = DateTime.UtcNow,
            EventDateTime = dto.EventDateTime,
            IsListedInCatalog = dto.IsListedInCatalog,
            Description = dto.Description,
            Place = dto.Place,
            City = dto.City,
            Schedule = dto.Schedule,
            TimeZone = dto.TimeZone
        };

        await _partyRepository.AddAsync(party);

        _logger.LogInformation(
            "Party created and saved: id={PartyId}, shortCode={ShortCode}, organizerId={OrganizerId}",
            party.Id,
            party.ShortCode,
            organizerId);

        var savedParty = await _partyRepository.GetByIdAsync(party.Id);
        if (savedParty == null)
        {
            _logger.LogError("Party was not saved correctly: id={PartyId}", party.Id);
            throw new InvalidOperationException("Failed to save party");
        }

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

        var organizerId = _httpContextAccessor.HttpContext?.GetOrganizerId();
        if (organizerId.HasValue)
        {
            await _partyAccessService.EnsurePartyOwnershipAsync(partyId, organizerId.Value);
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

    public async Task<List<PartyDto>> GetPartiesByOrganizerAsync()
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext == null)
        {
            throw new UnauthorizedAccessException("HTTP context is required");
        }
        var organizerId = httpContext.RequireOrganizerId("list parties");

        _logger.LogDebug("Getting parties for organizer: {OrganizerId}", organizerId);

        var parties = await _partyRepository.GetByOrganizerIdAsync(organizerId);
        _logger.LogDebug("Retrieved {Count} parties from repository for organizer {OrganizerId}",
            parties.Count, organizerId);

        var sessionStates = await _streamingRepository.GetAllSessionStatesAsync();
        var stateLookup = sessionStates.ToDictionary(s => s.Key, s => s.Value);

        var dtos = new List<PartyDto>(parties.Count);
        foreach (var party in parties)
        {
            var hasActiveSession = stateLookup.ContainsKey(party.Id);
            dtos.Add(party.ToDto(hasActiveSession));
            _logger.LogDebug("Party in list: id={PartyId}, shortCode={ShortCode}, name={Name}",
                party.Id, party.ShortCode, party.Name);
        }

        _logger.LogDebug("Found {Count} parties for organizer {OrganizerId}", dtos.Count, organizerId);
        return dtos;
    }

    public async Task UpdatePartyMetadataAsync(Guid partyId, UpdatePartyDto dto)
    {
        if (dto == null)
        {
            throw new ArgumentNullException(nameof(dto));
        }

        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext == null)
        {
            throw new UnauthorizedAccessException("HTTP context is required");
        }
        var organizerId = httpContext.RequireOrganizerId("update party");
        await _partyAccessService.EnsurePartyOwnershipAsync(partyId, organizerId);

        var party = await _partyRepository.GetByIdAsync(partyId);
        if (party == null)
        {
            throw new PartyNotFoundException(partyId);
        }

        if (dto.Name != null)
            party.Name = dto.Name;
        if (dto.ThemeId.HasValue)
            party.ThemeId = dto.ThemeId.Value;
        if (dto.EventDateTime.HasValue)
            party.EventDateTime = dto.EventDateTime;
        if (dto.CustomizationSettings != null)
        {
            if (!CustomizationSettingsValidator.IsValidCustomizationSettings(dto.CustomizationSettings))
            {
                throw new ArgumentException("CustomizationSettings must contain only string or number values", nameof(dto));
            }
            party.CustomizationSettings = CustomizationSettingsValidator.NormalizeCustomizationSettings(dto.CustomizationSettings);
        }
        if (dto.IsListedInCatalog.HasValue)
            party.IsListedInCatalog = dto.IsListedInCatalog.Value;
        if (dto.Description != null)
            party.Description = dto.Description;
        if (dto.Place != null)
            party.Place = dto.Place;
        if (dto.City != null)
            party.City = dto.City;
        if (dto.Schedule != null)
            party.Schedule = dto.Schedule;
        if (dto.TimeZone != null)
            party.TimeZone = dto.TimeZone;

        await _partyRepository.UpdateAsync(party);
        _logger.LogInformation("Party metadata updated: {PartyId}", partyId);
    }

    public async Task DeletePartyAsync(Guid partyId)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext == null)
        {
            throw new UnauthorizedAccessException("HTTP context is required");
        }
        var organizerId = httpContext.RequireOrganizerId("delete party");
        await _partyAccessService.EnsurePartyOwnershipAsync(partyId, organizerId);

        await _streamingRepository.DeleteSessionStateAsync(partyId);
        await _partyRepository.DeleteAsync(partyId);
        _logger.LogInformation("Party deleted: {PartyId}", partyId);
    }

    public async Task UpdatePartyPlaylistAsync(Guid partyId, PartyPlaylistDto playlist)
    {
        if (playlist == null)
        {
            throw new ArgumentNullException(nameof(playlist));
        }

        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext == null)
        {
            throw new UnauthorizedAccessException("HTTP context is required");
        }
        var organizerId = httpContext.RequireOrganizerId("update playlist");

        _logger.LogInformation(
            "Updating playlist for party: {PartyId}, totalTracks={TotalTracks}, organizerId={OrganizerId}",
            partyId,
            playlist.TotalTracks,
            organizerId);

        await _partyAccessService.EnsurePartyOwnershipAsync(partyId, organizerId);

        if (playlist.TotalTracks > AuthConstants.MaxPlaylistTracks)
        {
            throw new ArgumentException($"Playlist cannot contain more than {AuthConstants.MaxPlaylistTracks} tracks");
        }

        var party = await _partyRepository.GetByIdAsync(partyId);
        if (party == null)
        {
            _logger.LogWarning("Party not found for playlist update: {PartyId}", partyId);
            throw new PartyNotFoundException(partyId);
        }

        party.Playlist = playlist.ToEntity();
        await _partyRepository.UpdateAsync(party);

        await _playlistNotifier.NotifyPlaylistChangedAsync(partyId);
        _logger.LogInformation("Playlist updated for party: {PartyId}", partyId);
    }

}
