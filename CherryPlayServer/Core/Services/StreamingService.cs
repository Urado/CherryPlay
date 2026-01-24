using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Mappings;
using CherryPlayServer.Models;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Core.Services;

public class StreamingService : IStreamingService
{
    private readonly IPartyRepository _partyRepository;
    private readonly IStreamingRepository _streamingRepository;
    private readonly IPlaylistTrackFinder _trackFinder;
    private readonly ILogger<StreamingService> _logger;

    public StreamingService(
        IPartyRepository partyRepository,
        IStreamingRepository streamingRepository,
        IPlaylistTrackFinder trackFinder,
        ILogger<StreamingService> logger)
    {
        _partyRepository = partyRepository ?? throw new ArgumentNullException(nameof(partyRepository));
        _streamingRepository = streamingRepository ?? throw new ArgumentNullException(nameof(streamingRepository));
        _trackFinder = trackFinder ?? throw new ArgumentNullException(nameof(trackFinder));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<PartyStateDto?> GetPartyStateAsync(string shortCode)
    {
        if (string.IsNullOrWhiteSpace(shortCode))
        {
            throw new ArgumentException("Short code cannot be null or empty", nameof(shortCode));
        }

        _logger.LogDebug("Getting party state for shortCode: {ShortCode}", shortCode);

        var party = await _partyRepository.GetByShortCodeAsync(shortCode);
        if (party == null)
        {
            _logger.LogDebug("Party not found for shortCode: {ShortCode}", shortCode);
            return null;
        }

        var state = await _streamingRepository.GetSessionStateAsync(party.Id);
        return new PartyStateDto(
            partyId: party.Id.ToString(),
            isSessionActive: state != null,
            playbackState: state != null ? state.ToDto() : null,
            playlist: party.Playlist.ToDto()
        );
    }

    public async Task StartSessionAsync(Guid partyId)
    {
        _logger.LogInformation("Starting session for party: {PartyId}", partyId);

        var party = await _partyRepository.GetByIdAsync(partyId);
        if (party == null)
        {
            _logger.LogWarning("Cannot start session - party not found: {PartyId}", partyId);
            throw new PartyNotFoundException(partyId);
        }

        var initialState = new PlaybackState
        {
            Status = PlaybackStatus.Idle,
            Position = 0,
            Duration = 0,
            Volume = 0.8,
            Mode = PlaybackMode.Session,
            LastUpdatedAt = DateTime.UtcNow
        };

        await _streamingRepository.SetSessionStateAsync(party.Id, initialState);
        _logger.LogInformation("Session started for party: {PartyId}", partyId);
    }

    public async Task EndSessionAsync(Guid partyId)
    {
        _logger.LogInformation("Ending session for party: {PartyId}", partyId);

        var party = await _partyRepository.GetByIdAsync(partyId);
        if (party == null)
        {
            _logger.LogWarning("Cannot end session - party not found: {PartyId}", partyId);
            throw new PartyNotFoundException(partyId);
        }

        await _streamingRepository.DeleteSessionStateAsync(partyId);
        _logger.LogInformation("Session ended for party: {PartyId}", partyId);
    }

    public async Task UpdatePlaybackPositionAsync(Guid partyId, string trackId, double position)
    {
        // Валидация входных данных
        if (string.IsNullOrWhiteSpace(trackId))
        {
            throw new ArgumentException("Track ID cannot be null or empty", nameof(trackId));
        }

        if (position < 0)
        {
            throw new ArgumentException("Position cannot be negative", nameof(position));
        }

        _logger.LogDebug("Updating playback position: partyId={PartyId}, trackId={TrackId}, position={Position}",
            partyId, trackId, position);

        var party = await _partyRepository.GetByIdAsync(partyId);
        if (party == null)
        {
            _logger.LogWarning("Cannot update playback position - party not found: {PartyId}", partyId);
            throw new PartyNotFoundException(partyId);
        }

        var state = await _streamingRepository.GetSessionStateAsync(partyId);
        if (state == null)
        {
            _logger.LogDebug("No active session found for party: {PartyId}", partyId);
            throw new InvalidOperationException($"No active session found for party {partyId}");
        }

        double duration = state.Duration;
        if (party.Playlist != null && party.Playlist.Items != null)
        {
            var trackDuration = _trackFinder.FindTrackDuration(party.Playlist.Items, trackId);
            if (trackDuration.HasValue && trackDuration.Value > 0)
            {
                duration = trackDuration.Value;
            }
        }

        state.Position = position;
        state.CurrentTrackId = trackId;
        state.Duration = duration;
        state.LastUpdatedAt = DateTime.UtcNow;

        await _streamingRepository.SetSessionStateAsync(partyId, state);
    }

    public async Task UpdateFullStateAsync(Guid partyId, PlaybackStateDto stateDto)
    {
        if (stateDto == null)
        {
            throw new ArgumentNullException(nameof(stateDto));
        }

        _logger.LogDebug("Updating full state: partyId={PartyId}, status={Status}, trackId={TrackId}",
            partyId, stateDto.Status, stateDto.CurrentTrackId);

        var party = await _partyRepository.GetByIdAsync(partyId);
        if (party == null)
        {
            _logger.LogWarning("Cannot update full state - party not found: {PartyId}", partyId);
            throw new PartyNotFoundException(partyId);
        }

        var state = stateDto.ToEntity();

        double duration = state.Duration;
        if (party.Playlist != null &&
            party.Playlist.Items != null &&
            duration == 0 &&
            !string.IsNullOrEmpty(state.CurrentTrackId))
        {
            var trackDuration = _trackFinder.FindTrackDuration(party.Playlist.Items, state.CurrentTrackId);
            if (trackDuration.HasValue && trackDuration.Value > 0)
            {
                duration = trackDuration.Value;
            }
        }

        state.Duration = duration;
        state.LastUpdatedAt = DateTime.UtcNow;

        await _streamingRepository.SetSessionStateAsync(partyId, state);
    }
}
