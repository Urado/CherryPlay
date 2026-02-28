using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Mappings;
using CherryPlayServer.Models;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Core.Services;

public class PublicPartyQueryService : IPublicPartyQueryService
{
    private readonly IPartyRepository _partyRepository;
    private readonly IStreamingRepository _streamingRepository;
    private readonly ILogger<PublicPartyQueryService> _logger;

    public PublicPartyQueryService(
        IPartyRepository partyRepository,
        IStreamingRepository streamingRepository,
        ILogger<PublicPartyQueryService> logger)
    {
        _partyRepository = partyRepository ?? throw new ArgumentNullException(nameof(partyRepository));
        _streamingRepository = streamingRepository ?? throw new ArgumentNullException(nameof(streamingRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<PublicPartyDto?> GetPublicPartyAsync(string shortCode)
    {
        if (string.IsNullOrWhiteSpace(shortCode))
        {
            throw new ArgumentException("Short code cannot be null or empty", nameof(shortCode));
        }

        _logger.LogDebug("Getting public party by shortCode: {ShortCode}", shortCode);

        var party = await _partyRepository.GetByShortCodeAsync(shortCode);
        if (party == null)
        {
            _logger.LogDebug("Public party not found for shortCode: {ShortCode}", shortCode);
            return null;
        }

        var state = await _streamingRepository.GetSessionStateAsync(party.Id);
        return party.ToPublicDto(state?.IsActive ?? false, state?.SessionStartedAt);
    }

    public async Task<PartyPlaylistDto?> GetPartyPlaylistByShortCodeAsync(string shortCode)
    {
        if (string.IsNullOrWhiteSpace(shortCode))
        {
            throw new ArgumentException("Short code cannot be null or empty", nameof(shortCode));
        }

        _logger.LogDebug("Getting playlist by shortCode: {ShortCode}", shortCode);

        var party = await _partyRepository.GetByShortCodeAsync(shortCode);
        if (party == null)
        {
            _logger.LogDebug("Party not found for playlist request: {ShortCode}", shortCode);
            return null;
        }

        return party.Playlist.ToDto();
    }

    public async Task<List<PublicPartyListItemDto>> GetAllPublicPartiesAsync()
    {
        _logger.LogDebug("Getting all public parties (catalog only)");

        var allParties = await _partyRepository.GetAllAsync();
        var parties = allParties.Where(p => p.IsListedInCatalog).ToList();
        var sessionStates = await _streamingRepository.GetAllSessionStatesAsync();
        var stateLookup = sessionStates.ToDictionary(s => s.Key, s => s.Value);

        var dtos = parties.Select(party =>
        {
            var hasActiveSession = stateLookup.TryGetValue(party.Id, out var s) && s.IsActive;
            return new PublicPartyListItemDto(
                Id: party.Id.ToString(),
                Name: party.Name,
                Title: party.Title,
                Subtitle: party.Subtitle,
                ShortCode: party.ShortCode,
                PartyThemeId: party.PartyThemeId,
                HasActiveSession: hasActiveSession,
                CreatedAt: party.CreatedAt.ToString("O"),
                TotalTracks: party.Playlist.TotalTracks,
                TotalDuration: party.Playlist.TotalDuration,
                EventDateTime: party.EventDateTime?.ToString("O"),
                TimeZone: party.TimeZone,
                City: party.City
            );
        }).ToList();

        _logger.LogDebug("Found {Count} public parties", dtos.Count);
        return dtos;
    }

    public async Task<PartyPlaylistDto?> GetFirstPartyPlaylistAsync()
    {
        _logger.LogDebug("Getting first party playlist");

        var party = await _partyRepository.GetFirstAsync();
        if (party == null)
        {
            _logger.LogDebug("No parties found for first playlist request");
            return null;
        }

        return party.Playlist.ToDto();
    }
}
