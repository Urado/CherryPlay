using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Options;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class StreamingServiceRegressionTests
{
    [Test]
    public async Task StartSession_WhenStateExists_RestoresPlaybackAndSanitizesRemovedItems()
    {
        var (service, parties, states) = CreateService();
        var partyId = Guid.NewGuid();
        await parties.AddAsync(CreateParty(partyId, [
            new PlayerItem { Id = "group-a", Type = PlayerItemType.Group, Items = [
                new PlayerItem { Id = "track-a", Type = PlayerItemType.Track, Duration = 180 }
            ] }
        ]));
        await states.SetSessionStateAsync(partyId, new PlaybackState
        {
            CurrentTrackId = "removed-track",
            Position = 38,
            Duration = 180,
            PlayedTrackIds = ["track-a", "removed-track"],
            DisabledTrackIds = ["removed-track"],
            DisabledGroupIds = ["removed-group"],
            IsActive = false,
            Mode = PlaybackMode.Preparation
        });

        await service.StartSessionAsync(partyId);

        var state = await states.GetSessionStateAsync(partyId);
        Assert.That(state!.IsActive, Is.True);
        Assert.That(state.Mode, Is.EqualTo(PlaybackMode.Session));
        Assert.That(state.CurrentTrackId, Is.Null);
        Assert.That(state.Position, Is.Zero);
        Assert.That(state.Duration, Is.Zero);
        Assert.That(state.PlayedTrackIds, Is.EqualTo(["track-a"]));
        Assert.That(state.DisabledTrackIds, Is.Empty);
        Assert.That(state.DisabledGroupIds, Is.Empty);
    }

    [Test]
    public async Task StartSession_WhenCurrentTrackStillExists_RestoresPlaybackAndRetainedItems()
    {
        var (service, parties, states) = CreateService();
        var partyId = Guid.NewGuid();
        await parties.AddAsync(CreateParty(partyId, [new PlayerItem
        {
            Id = "group-a",
            Type = PlayerItemType.Group,
            Items = [
                new PlayerItem { Id = "track-a", Type = PlayerItemType.Track, Duration = 240 },
                new PlayerItem { Id = "track-b", Type = PlayerItemType.Track, Duration = 180 }
            ]
        }]));
        await states.SetSessionStateAsync(partyId, new PlaybackState
        {
            CurrentTrackId = "track-a",
            Position = 37,
            Duration = 240,
            PlayedTrackIds = ["track-a", "track-b"],
            DisabledTrackIds = ["track-b"],
            DisabledGroupIds = ["group-a"],
            IsActive = false,
            Mode = PlaybackMode.Preparation,
            Status = PlaybackStatus.Paused
        });

        await service.StartSessionAsync(partyId);

        var state = await states.GetSessionStateAsync(partyId);
        Assert.That(state!.IsActive, Is.True);
        Assert.That(state.Mode, Is.EqualTo(PlaybackMode.Session));
        Assert.That(state.CurrentTrackId, Is.EqualTo("track-a"));
        Assert.That(state.Position, Is.EqualTo(37));
        Assert.That(state.Duration, Is.EqualTo(240));
        Assert.That(state.Status, Is.EqualTo(PlaybackStatus.Paused));
        Assert.That(state.PlayedTrackIds, Is.EqualTo(["track-a", "track-b"]));
        Assert.That(state.DisabledTrackIds, Is.EqualTo(["track-b"]));
        Assert.That(state.DisabledGroupIds, Is.EqualTo(["group-a"]));
    }

    [Test]
    public async Task StartSession_WhenPlaylistIsEmpty_PreservesExistingPlaybackReferences()
    {
        var (service, parties, states) = CreateService();
        var partyId = Guid.NewGuid();
        await parties.AddAsync(CreateParty(partyId, []));
        await states.SetSessionStateAsync(partyId, new PlaybackState
        {
            CurrentTrackId = "removed-track",
            Position = 38,
            Duration = 180,
            PlayedTrackIds = ["removed-track"],
            DisabledTrackIds = ["removed-track"],
            DisabledGroupIds = ["removed-group"],
            IsActive = false
        });

        await service.StartSessionAsync(partyId);

        var state = await states.GetSessionStateAsync(partyId);
        Assert.That(state!.CurrentTrackId, Is.EqualTo("removed-track"));
        Assert.That(state.Position, Is.EqualTo(38));
        Assert.That(state.Duration, Is.EqualTo(180));
        Assert.That(state.PlayedTrackIds, Is.EqualTo(["removed-track"]));
        Assert.That(state.DisabledTrackIds, Is.EqualTo(["removed-track"]));
        Assert.That(state.DisabledGroupIds, Is.EqualTo(["removed-group"]));
    }

    [Test]
    public async Task StartSession_WhenNoState_CreatesInitialActiveSession()
    {
        var (service, parties, states) = CreateService();
        var partyId = Guid.NewGuid();
        await parties.AddAsync(CreateParty(partyId, []));

        await service.StartSessionAsync(partyId);

        var state = await states.GetSessionStateAsync(partyId);
        Assert.That(state!.IsActive, Is.True);
        Assert.That(state.Mode, Is.EqualTo(PlaybackMode.Session));
        Assert.That(state.Status, Is.EqualTo(PlaybackStatus.Idle));
        Assert.That(state.Position, Is.Zero);
        Assert.That(state.Duration, Is.Zero);
        Assert.That(state.Volume, Is.EqualTo(0.8));
    }

    [Test]
    public async Task EndSession_FreezesExistingPlaybackState()
    {
        var (service, parties, states) = CreateService();
        var partyId = Guid.NewGuid();
        await parties.AddAsync(CreateParty(partyId, []));
        await states.SetSessionStateAsync(partyId, new PlaybackState
        {
            CurrentTrackId = "track-a",
            Position = 42,
            Duration = 180,
            PlayedTrackIds = ["track-a"],
            DisabledTrackIds = ["track-b"],
            DisabledGroupIds = ["group-a"],
            IsActive = true,
            Mode = PlaybackMode.Session,
            Status = PlaybackStatus.Playing
        });

        await service.EndSessionAsync(partyId);

        var state = await states.GetSessionStateAsync(partyId);
        Assert.That(state!.IsActive, Is.False);
        Assert.That(state.Mode, Is.EqualTo(PlaybackMode.Preparation));
        Assert.That(state.Status, Is.EqualTo(PlaybackStatus.Ended));
        Assert.That(state.CurrentTrackId, Is.EqualTo("track-a"));
        Assert.That(state.Position, Is.EqualTo(42));
        Assert.That(state.PlayedTrackIds, Is.EqualTo(["track-a"]));
        Assert.That(state.DisabledTrackIds, Is.EqualTo(["track-b"]));
        Assert.That(state.DisabledGroupIds, Is.EqualTo(["group-a"]));
    }

    [Test]
    public async Task ResetPlaybackState_ClearsPlaybackWhileKeepingPartyAndPlaylist()
    {
        var (service, parties, states) = CreateService();
        var partyId = Guid.NewGuid();
        await parties.AddAsync(CreateParty(partyId, [new PlayerItem { Id = "track-a", Type = PlayerItemType.Track }]));
        await states.SetSessionStateAsync(partyId, new PlaybackState
        {
            CurrentTrackId = "track-a",
            Position = 42,
            Duration = 180,
            PlayedTrackIds = ["track-a"],
            DisabledTrackIds = ["track-b"],
            DisabledGroupIds = ["group-a"],
            IsActive = true,
            Mode = PlaybackMode.Session,
            Status = PlaybackStatus.Playing
        });

        await service.ResetPlaybackStateAsync(partyId);

        var state = await states.GetSessionStateAsync(partyId);
        var party = await parties.GetByIdAsync(partyId);
        Assert.That(state!.IsActive, Is.False);
        Assert.That(state.Mode, Is.EqualTo(PlaybackMode.Preparation));
        Assert.That(state.Status, Is.EqualTo(PlaybackStatus.Idle));
        Assert.That(state.CurrentTrackId, Is.Null);
        Assert.That(state.Position, Is.Zero);
        Assert.That(state.Duration, Is.Zero);
        Assert.That(state.PlayedTrackIds, Is.Empty);
        Assert.That(state.DisabledTrackIds, Is.Empty);
        Assert.That(state.DisabledGroupIds, Is.Empty);
        Assert.That(party!.Playlist.Items.Single().Id, Is.EqualTo("track-a"));
    }

    [Test]
    public async Task UpdatePlaybackPosition_FindsDurationInsideNestedGroup()
    {
        var (service, parties, states) = CreateService();
        var partyId = Guid.NewGuid();
        await parties.AddAsync(CreateParty(partyId, [new PlayerItem
        {
            Id = "group-a",
            Type = PlayerItemType.Group,
            Items = [new PlayerItem { Id = "track-a", Type = PlayerItemType.Track, Duration = 240 }]
        }]));
        await states.SetSessionStateAsync(partyId, new PlaybackState { IsActive = true });

        await service.UpdatePlaybackPositionAsync(partyId, "track-a", 55);

        var state = await states.GetSessionStateAsync(partyId);
        Assert.That(state!.CurrentTrackId, Is.EqualTo("track-a"));
        Assert.That(state.Position, Is.EqualTo(55));
        Assert.That(state.Duration, Is.EqualTo(240));
    }

    [TestCase("", 0)]
    [TestCase("track-a", -1)]
    public async Task UpdatePlaybackPosition_InvalidInputDoesNotChangeState(string trackId, double position)
    {
        var (service, parties, states) = CreateService();
        var partyId = Guid.NewGuid();
        await parties.AddAsync(CreateParty(partyId, []));
        await states.SetSessionStateAsync(partyId, new PlaybackState { CurrentTrackId = "original", Position = 12 });

        Assert.ThrowsAsync<ArgumentException>(() => service.UpdatePlaybackPositionAsync(partyId, trackId, position));

        var state = await states.GetSessionStateAsync(partyId);
        Assert.That(state!.CurrentTrackId, Is.EqualTo("original"));
        Assert.That(state.Position, Is.EqualTo(12));
    }

    [Test]
    public async Task UpdateFullState_PreservesServerIsActiveValue()
    {
        var (service, parties, states) = CreateService();
        var partyId = Guid.NewGuid();
        await parties.AddAsync(CreateParty(partyId, []));
        await states.SetSessionStateAsync(partyId, new PlaybackState { IsActive = false });

        await service.UpdateFullStateAsync(partyId, new CherryPlayServer.Models.PlaybackStateDto
        {
            Mode = PlaybackMode.Session,
            Status = PlaybackStatus.Playing,
            CurrentTrackId = "track-a",
            Position = 25
        });

        var state = await states.GetSessionStateAsync(partyId);
        Assert.That(state!.IsActive, Is.False);
        Assert.That(state.Mode, Is.EqualTo(PlaybackMode.Session));
        Assert.That(state.Status, Is.EqualTo(PlaybackStatus.Playing));
        Assert.That(state.Position, Is.EqualTo(25));
        Assert.That(state.SessionStartedAt, Is.Not.Null);
    }

    [Test]
    public async Task UpdateFullState_FindsDurationInsideNestedGroup()
    {
        var (service, parties, states) = CreateService();
        var partyId = Guid.NewGuid();
        await parties.AddAsync(CreateParty(partyId, [new PlayerItem
        {
            Id = "group-a",
            Type = PlayerItemType.Group,
            Items = [new PlayerItem { Id = "track-a", Type = PlayerItemType.Track, Duration = 240 }]
        }]));

        await service.UpdateFullStateAsync(partyId, new CherryPlayServer.Models.PlaybackStateDto
        {
            Mode = PlaybackMode.Session,
            CurrentTrackId = "track-a",
            Position = 25
        });

        var state = await states.GetSessionStateAsync(partyId);
        Assert.That(state!.Duration, Is.EqualTo(240));
    }

    private static (StreamingService Service, InMemoryPartyRepository Parties, InMemoryStreamingRepository States) CreateService()
    {
        var parties = new InMemoryPartyRepository();
        var states = new InMemoryStreamingRepository();
        var service = new StreamingService(
            parties,
            states,
            new PlaylistTrackFinder(),
            new StubPartyDisplayStatusService(PartyDisplayStatus.Scheduled),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<StreamingService>.Instance);
        return (service, parties, states);
    }

    private static Party CreateParty(Guid partyId, List<PlayerItem> items) => new()
    {
        Id = partyId,
        OrganizerId = Guid.NewGuid(),
        Name = "Regression Party",
        ShortCode = Guid.NewGuid().ToString("N")[..6],
        PartyThemeId = PartyThemeDefaults.Id,
        Playlist = new PartyPlaylist { Items = items },
        CreatedAt = DateTime.UtcNow,
        PartyLifecycleState = PartyLifecycleState.Ready
    };
}
