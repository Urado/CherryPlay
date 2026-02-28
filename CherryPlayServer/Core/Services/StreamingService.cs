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
        var serverTrackIds = GetFlattenedTrackIds(party.Playlist?.Items);
        var serverTrackIdsSnapshot = serverTrackIds.ToArray();
        return new PartyStateDto(
            partyId: party.Id.ToString(),
            isSessionActive: state?.IsActive ?? false,
            playbackState: state != null ? state.ToDto() : null,
            playlist: party.Playlist.ToDto(),
            serverTrackIds: serverTrackIdsSnapshot
        );
    }

    private static IReadOnlyList<string> GetFlattenedTrackIds(List<Core.Entities.PlayerItem>? items)
    {
        if (items == null || items.Count == 0)
            return Array.Empty<string>();
        var list = new List<string>();
        foreach (var item in items)
        {
            if (item.Type == PlayerItemType.Track && !string.IsNullOrEmpty(item.Id))
                list.Add(item.Id);
            else if (item.Type == PlayerItemType.Group && item.Items != null)
                list.AddRange(GetFlattenedTrackIds(item.Items));
        }
        return list;
    }

    private static (HashSet<string> trackIds, HashSet<string> groupIds) GetValidTrackAndGroupIds(List<Core.Entities.PlayerItem>? items)
    {
        var trackIds = new HashSet<string>(StringComparer.Ordinal);
        var groupIds = new HashSet<string>(StringComparer.Ordinal);
        if (items == null || items.Count == 0)
            return (trackIds, groupIds);
        CollectTrackAndGroupIds(items, trackIds, groupIds);
        return (trackIds, groupIds);
    }

    private static void CollectTrackAndGroupIds(List<Core.Entities.PlayerItem> items, HashSet<string> trackIds, HashSet<string> groupIds)
    {
        foreach (var item in items)
        {
            if (string.IsNullOrEmpty(item.Id))
                continue;
            if (item.Type == PlayerItemType.Track)
                trackIds.Add(item.Id);
            else if (item.Type == PlayerItemType.Group)
            {
                groupIds.Add(item.Id);
                if (item.Items != null)
                    CollectTrackAndGroupIds(item.Items, trackIds, groupIds);
            }
        }
    }

    private static void SanitizeRestoredState(PlaybackState state, List<Core.Entities.PlayerItem>? playlistItems)
    {
        var (trackIds, groupIds) = GetValidTrackAndGroupIds(playlistItems);
        if (trackIds.Count == 0 && groupIds.Count == 0)
            return;

        if (!string.IsNullOrEmpty(state.CurrentTrackId) && !trackIds.Contains(state.CurrentTrackId))
        {
            state.CurrentTrackId = null;
            state.Position = 0;
            state.Duration = 0;
        }
        if (state.PlayedTrackIds.Count > 0)
            state.PlayedTrackIds = state.PlayedTrackIds.Where(id => trackIds.Contains(id)).ToList();
        if (state.DisabledTrackIds.Count > 0)
            state.DisabledTrackIds = state.DisabledTrackIds.Where(id => trackIds.Contains(id)).ToList();
        if (state.DisabledGroupIds.Count > 0)
            state.DisabledGroupIds = state.DisabledGroupIds.Where(id => groupIds.Contains(id)).ToList();
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

        var existingState = await _streamingRepository.GetSessionStateAsync(party.Id);
        if (existingState != null)
        {
            existingState.IsActive = true;
            existingState.Mode = PlaybackMode.Session;
            existingState.SessionStartedAt = DateTime.UtcNow;
            existingState.LastUpdatedAt = DateTime.UtcNow;
            SanitizeRestoredState(existingState, party.Playlist?.Items);
            await _streamingRepository.SetSessionStateAsync(party.Id, existingState);
            _logger.LogInformation("Session restored for party: {PartyId}", partyId);
            return;
        }

        var initialState = new PlaybackState
        {
            Status = PlaybackStatus.Idle,
            Position = 0,
            Duration = 0,
            Volume = 0.8,
            Mode = PlaybackMode.Session,
            SessionStartedAt = DateTime.UtcNow,
            LastUpdatedAt = DateTime.UtcNow,
            IsActive = true,
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

        var state = await _streamingRepository.GetSessionStateAsync(partyId);
        if (state != null)
        {
            state.IsActive = false;
            state.Status = PlaybackStatus.Ended;
            state.LastUpdatedAt = DateTime.UtcNow;
            await _streamingRepository.SetSessionStateAsync(partyId, state);
        }

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

        // Если SessionStartedAt не установлен и сессия только начинается, устанавливаем его
        if (!state.SessionStartedAt.HasValue && state.Mode == PlaybackMode.Session)
        {
            state.SessionStartedAt = DateTime.UtcNow;
        }

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
