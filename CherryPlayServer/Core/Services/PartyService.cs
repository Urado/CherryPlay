using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Mappings;
using CherryPlayServer.Core.Validators;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Models;

using static CherryPlayServer.Core.PartyConstants;
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
    private readonly IThemeAccessService _themeAccessService;
    private readonly ILogger<PartyService> _logger;

    public PartyService(
        IPartyRepository partyRepository,
        IStreamingRepository streamingRepository,
        IShortCodeGenerator shortCodeGenerator,
        IHttpContextAccessor httpContextAccessor,
        IPartyPlaylistNotifier playlistNotifier,
        IPartyAccessService partyAccessService,
        IThemeAccessService themeAccessService,
        ILogger<PartyService> logger)
    {
        _partyRepository = partyRepository ?? throw new ArgumentNullException(nameof(partyRepository));
        _streamingRepository = streamingRepository ?? throw new ArgumentNullException(nameof(streamingRepository));
        _shortCodeGenerator = shortCodeGenerator ?? throw new ArgumentNullException(nameof(shortCodeGenerator));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
        _playlistNotifier = playlistNotifier ?? throw new ArgumentNullException(nameof(playlistNotifier));
        _partyAccessService = partyAccessService ?? throw new ArgumentNullException(nameof(partyAccessService));
        _themeAccessService = themeAccessService ?? throw new ArgumentNullException(nameof(themeAccessService));
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
        var selectedThemeId = dto.PartyThemeId.ToStringValue();
        var access = await _themeAccessService.CheckThemeAccessAsync(organizerId, selectedThemeId);
        if (!access.IsAllowed)
            throw new ThemeNotEntitledException(selectedThemeId, access.RequiredPackageCodes);

        _logger.LogInformation(
            "Creating party: name={Name}, partyThemeId={PartyThemeId}, organizerId={OrganizerId}",
            dto.Name,
            dto.PartyThemeId,
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

        ValidatePartyCardFields(dto.ShortDescription, dto.DanceTags, nameof(dto));

        var party = new Party
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizerId,
            Name = dto.Name,
            Title = dto.Title,
            Subtitle = dto.Subtitle,
            ShortCode = shortCode,
            PartyThemeId = dto.PartyThemeId,
            CustomizationSettings = normalizedSettings,
            Playlist = dto.PlaylistData?.ToEntity() ?? new PartyPlaylist(),
            CreatedAt = DateTime.UtcNow,
            EventDateTime = dto.EventDateTime,
            EventEndDateTime = dto.EventEndDateTime,
            IsListedInCatalog = dto.IsListedInCatalog,
            Description = dto.Description,
            Place = dto.Place,
            City = dto.City,
            Schedule = dto.Schedule,
            TimeZone = dto.TimeZone,
            ShortDescription = TrimToNull(dto.ShortDescription),
            ExternalLinkUrl = TrimToNull(dto.ExternalLinkUrl),
            ExternalLinkText = string.IsNullOrWhiteSpace(TrimToNull(dto.ExternalLinkUrl)) ? null : TrimToNull(dto.ExternalLinkText),
            DanceTags = NormalizeDanceTags(dto.DanceTags),
            PartyLifecycleState = PartyLifecycleState.Ready,
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
        return savedParty.ToDto(state != null);
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
        var visibleParties = parties.Where(p => p.PartyLifecycleState != PartyLifecycleState.Draft).ToList();
        var sessionStates = await _streamingRepository.GetAllSessionStatesAsync();
        var stateLookup = sessionStates.ToDictionary(s => s.Key, s => s.Value);

        var dtos = new List<PartyDto>(visibleParties.Count);
        foreach (var party in visibleParties)
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
        var visibleParties = parties.Where(p => p.PartyLifecycleState != PartyLifecycleState.Draft).ToList();
        _logger.LogDebug("Retrieved {Count} parties from repository for organizer {OrganizerId} ({VisibleCount} visible in list)",
            parties.Count, organizerId, visibleParties.Count);

        var sessionStates = await _streamingRepository.GetAllSessionStatesAsync();
        var stateLookup = sessionStates.ToDictionary(s => s.Key, s => s.Value);

        var dtos = new List<PartyDto>(visibleParties.Count);
        foreach (var party in visibleParties)
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

        ValidatePartyCardFields(dto.ShortDescription, dto.DanceTags, nameof(dto));

        if (dto.Name != null)
            party.Name = dto.Name;
        if (dto.Title != null)
            party.Title = dto.Title;
        if (dto.Subtitle != null)
            party.Subtitle = dto.Subtitle;
        if (dto.PartyThemeId.HasValue)
        {
            var newThemeId = dto.PartyThemeId.Value.ToStringValue();
            if (!string.Equals(newThemeId, party.PartyThemeId.ToStringValue(), StringComparison.Ordinal))
            {
                var access = await _themeAccessService.CheckThemeAccessAsync(organizerId, newThemeId);
                if (!access.IsAllowed)
                    throw new ThemeNotEntitledException(newThemeId, access.RequiredPackageCodes);
            }
            party.PartyThemeId = dto.PartyThemeId.Value;
        }
        if (dto.EventDateTime.HasValue)
            party.EventDateTime = dto.EventDateTime;
        if (dto.EventEndDateTime.HasValue)
            party.EventEndDateTime = dto.EventEndDateTime;
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
        if (dto.ShortDescription != null)
            party.ShortDescription = TrimToNull(dto.ShortDescription);
        if (dto.ExternalLinkUrl != null)
            party.ExternalLinkUrl = TrimToNull(dto.ExternalLinkUrl);
        if (dto.ExternalLinkText != null)
            party.ExternalLinkText = TrimToNull(dto.ExternalLinkText);
        if (string.IsNullOrWhiteSpace(party.ExternalLinkUrl))
            party.ExternalLinkText = null;
        if (dto.DanceTags != null)
            party.DanceTags = NormalizeDanceTags(dto.DanceTags);

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

    public async Task<PartyDto> TransitionPartyLifecycleAsync(Guid partyId, PartyLifecycleState targetState) =>
        await TransitionPartyLifecycleCoreAsync(partyId, targetState, "transition party lifecycle");

    private async Task<PartyDto> TransitionPartyLifecycleCoreAsync(
        Guid partyId,
        PartyLifecycleState targetState,
        string actionDescription)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext == null)
        {
            throw new UnauthorizedAccessException("HTTP context is required");
        }

        var organizerId = httpContext.RequireOrganizerId(actionDescription);

        var party = await _partyRepository.GetByIdAsync(partyId);
        if (party == null)
        {
            throw new PartyNotFoundException(partyId);
        }

        if (party.OrganizerId != organizerId)
        {
            throw new ForbiddenException("You do not have permission to access this party");
        }

        var currentState = party.PartyLifecycleState;
        if (currentState != targetState)
        {
            if (!IsAllowedPartyLifecycleTransition(currentState, targetState))
            {
                throw new InvalidPartyLifecycleTransitionException(partyId, currentState, targetState);
            }

            party.PartyLifecycleState = targetState;
            await _partyRepository.UpdateAsync(party);
            _logger.LogInformation(
                "Party lifecycle transitioned: {PartyId} {FromState} -> {ToState}",
                partyId,
                currentState,
                targetState);
        }

        var sessionState = await _streamingRepository.GetSessionStateAsync(partyId);
        return party.ToDto(sessionState != null);
    }

    private static bool IsAllowedPartyLifecycleTransition(
        PartyLifecycleState current,
        PartyLifecycleState target) =>
        (current, target) switch
        {
            (PartyLifecycleState.Draft, PartyLifecycleState.Ready) => true,
            (PartyLifecycleState.Ready, PartyLifecycleState.Completed) => true,
            _ => false,
        };

    private static void ValidatePartyCardFields(string? shortDescription, List<string>? danceTags, string paramName)
    {
        if (shortDescription != null && shortDescription.Length > MaxShortDescriptionLength)
            throw new ArgumentException($"Short description must not exceed {MaxShortDescriptionLength} characters", paramName);
        if (danceTags != null && danceTags.Count > MaxDanceTagsCount)
            throw new ArgumentException($"Dance tags must not exceed {MaxDanceTagsCount} items", paramName);
        if (danceTags != null && danceTags.Any(t => t != null && t.Length > MaxDanceTagLength))
            throw new ArgumentException($"Each dance tag must not exceed {MaxDanceTagLength} characters", paramName);
    }

    private static List<string> NormalizeDanceTags(List<string>? tags)
    {
        if (tags == null || tags.Count == 0) return [];
        var normalized = tags
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t =>
            {
                var s = t!.Trim();
                return s.Length > MaxDanceTagLength ? s[..MaxDanceTagLength] : s;
            })
            .Distinct(StringComparer.Ordinal)
            .Take(MaxDanceTagsCount)
            .ToList();
        return normalized;
    }

    private static string? TrimToNull(string? value)
    {
        if (value == null) return null;
        var t = value.Trim();
        return t.Length == 0 ? null : t;
    }
}
