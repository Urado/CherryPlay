using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Options;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Models;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Tests;

[TestFixture]
[Category("AdminPartyInMemoryIntegration")]
public sealed class AdminPartyActivityCoordinationIntegrationTests
{
    [TestCase("full-state")]
    [TestCase("position")]
    public async Task AdminReset_WaitsForOverlappingUserPlaybackWriteAndClearsItsResult(string updateType)
    {
        var party = new Party
        {
            Id = Guid.NewGuid(),
            OrganizerId = Guid.NewGuid(),
            Name = "Playback interleaving",
            ShortCode = "inter01",
            PartyLifecycleState = PartyLifecycleState.Ready,
            IsListedInCatalog = true,
            Playlist = new PartyPlaylist
            {
                Items = [new CherryPlayServer.Core.Entities.PlayerItem { Id = "track-1", Type = PlayerItemType.Track, Duration = 90 }],
                TotalTracks = 1,
                TotalDuration = 90
            }
        };
        var partyRepository = new InMemoryPartyRepository();
        await partyRepository.AddAsync(party);
        var streamingRepository = new BlockingReadStreamingRepository(new PlaybackState
        {
            IsActive = true,
            Mode = PlaybackMode.Session,
            SessionStartedAt = DateTime.UtcNow.AddMinutes(-10),
            CurrentTrackId = "track-1",
            Status = PlaybackStatus.Playing,
            Position = 20,
            Duration = 90,
            PlayedTrackIds = ["track-1"]
        });
        var connectionTracker = new OrganizerConnectionTracker();
        var coordinator = new PartyActivityCoordinator();
        var partyStatus = new PartyDisplayStatusService(
            connectionTracker,
            Options.Create(new PartyDisplayStatusOptions()));
        var streamingService = new StreamingService(
            partyRepository,
            streamingRepository,
            new PlaylistTrackFinder(),
            partyStatus,
            NullLogger<StreamingService>.Instance,
            coordinator);
        var notifier = new ResetNotifier();
        var adminCommandService = new AdminPartyCommandService(
            new AdminPartyCommandRepository(party),
            streamingRepository,
            connectionTracker,
            coordinator,
            new RecordingPartyStateNotifier(),
            notifier);

        var update = updateType == "full-state"
            ? streamingService.UpdateFullStateAsync(party.Id, new PlaybackStateDto
            {
                CurrentTrackId = "track-1",
                Status = PlaybackStatus.Playing,
                Position = 47,
                Duration = 90,
                Mode = PlaybackMode.Session,
                PlayedTrackIds = ["track-1"],
                LastUpdatedAt = DateTime.UtcNow
            })
            : streamingService.UpdatePlaybackPositionAsync(party.Id, "track-1", 47);
        await streamingRepository.FirstReadEntered.Task;
        var reset = adminCommandService.ResetSessionAsync(party.Id);

        Assert.That(reset.IsCompleted, Is.False);
        streamingRepository.AllowFirstRead.TrySetResult();
        await Task.WhenAll(update, reset);

        var finalState = streamingRepository.Session!;
        Assert.That(finalState.IsActive, Is.False);
        Assert.That(finalState.Mode, Is.EqualTo(PlaybackMode.Preparation));
        Assert.That(finalState.CurrentTrackId, Is.Null);
        Assert.That(finalState.Position, Is.Zero);
        Assert.That(finalState.PlayedTrackIds, Is.Empty);
        Assert.That(streamingRepository.Writes, Has.Count.EqualTo(2));
        Assert.That(streamingRepository.Writes[0].CurrentTrackId, Is.EqualTo("track-1"));
        Assert.That(streamingRepository.Writes[0].Position, Is.EqualTo(47));
        Assert.That(streamingRepository.Writes[1].CurrentTrackId, Is.Null);
        Assert.That(notifier.Notifications, Has.Count.EqualTo(1));
    }

    private sealed class BlockingReadStreamingRepository(PlaybackState initialState) : IStreamingRepository
    {
        private int _readCount;

        public TaskCompletionSource FirstReadEntered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource AllowFirstRead { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public PlaybackState? Session { get; private set; } = initialState.Clone();
        public List<PlaybackState> Writes { get; } = [];

        public async Task<PlaybackState?> GetSessionStateAsync(Guid partyId)
        {
            var snapshot = Session?.Clone();
            if (Interlocked.Increment(ref _readCount) == 1)
            {
                FirstReadEntered.TrySetResult();
                await AllowFirstRead.Task;
            }
            return snapshot;
        }

        public Task SetSessionStateAsync(Guid partyId, PlaybackState state)
        {
            var clone = state.Clone();
            Writes.Add(clone);
            Session = clone;
            return Task.CompletedTask;
        }

        public Task DeleteSessionStateAsync(Guid partyId)
        {
            Session = null;
            return Task.CompletedTask;
        }

        public Task<Dictionary<Guid, PlaybackState>> GetAllSessionStatesAsync() =>
            Task.FromResult(Session is null ? [] : new Dictionary<Guid, PlaybackState> { [Guid.Empty] = Session.Clone() });
    }

    private sealed class PlaylistTrackFinder : IPlaylistTrackFinder
    {
        public double? FindTrackDuration(List<CherryPlayServer.Core.Entities.PlayerItem> items, string trackId) => 90;
    }

    private sealed class ResetNotifier : IPartySessionResetNotifier
    {
        public List<Guid> Notifications { get; } = [];

        public Task NotifySessionResetAsync(Guid partyId, PartyLifecycleState lifecycleState, PlaybackState state)
        {
            Notifications.Add(partyId);
            return Task.CompletedTask;
        }
    }
}
