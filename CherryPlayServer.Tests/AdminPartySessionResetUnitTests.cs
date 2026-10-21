using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure;

namespace CherryPlayServer.Tests;

[TestFixture]
[Category("AdminPartyUnit")]
public sealed class AdminPartySessionResetUnitTests
{
    [Test]
    public async Task ResetSession_StaleOfflineSession_ClearsPlaybackAndPreservesPartyData()
    {
        var party = CreateParty();
        party.Playlist.Items.Add(new CherryPlayServer.Core.Entities.PlayerItem { Id = "track-1" });
        var (service, repository, streaming, notifier, tracker) = CreateService(party);
        streaming.Session = new PlaybackState
        {
            IsActive = true,
            SessionStartedAt = DateTime.UtcNow.AddHours(-1),
            CurrentTrackId = "track-1",
            Status = PlaybackStatus.Playing,
            Position = 32,
            Duration = 200,
            Mode = PlaybackMode.Session,
            PlayedTrackIds = ["track-1"],
            DisabledTrackIds = ["track-2"],
            DisabledGroupIds = ["group-1"]
        };

        var result = await service.ResetSessionAsync(party.Id);

        Assert.That(result.Kind, Is.EqualTo(AdminPartyCommandResultKind.Updated));
        Assert.That(result.WasReset, Is.True);
        Assert.That(result.PlaybackState!.IsActive, Is.False);
        Assert.That(result.PlaybackState.SessionStartedAt, Is.Null);
        Assert.That(result.PlaybackState.CurrentTrackId, Is.Null);
        Assert.That(result.PlaybackState.Status, Is.EqualTo(PlaybackStatus.Idle));
        Assert.That(result.PlaybackState.Mode, Is.EqualTo(PlaybackMode.Preparation));
        Assert.That(result.PlaybackState.Position, Is.Zero);
        Assert.That(result.PlaybackState.Duration, Is.Zero);
        Assert.That(result.PlaybackState.PlayedTrackIds, Is.Empty);
        Assert.That(result.PlaybackState.DisabledTrackIds, Is.Empty);
        Assert.That(result.PlaybackState.DisabledGroupIds, Is.Empty);
        Assert.That(result.PlaybackState.Volume, Is.EqualTo(0.8));
        Assert.That(streaming.Writes, Is.EqualTo(1));
        Assert.That(notifier.Notifications, Has.Count.EqualTo(1));
        Assert.That(repository.Party.Playlist.Items, Has.Count.EqualTo(1));
        Assert.That(repository.Party.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
        Assert.That(repository.Party.IsListedInCatalog, Is.True);
        Assert.That(tracker.IsOrganizerConnected(party.Id), Is.False);
    }

    [Test]
    public async Task ResetSession_ActiveConnectedOrganizer_IsRejectedWithoutEffects()
    {
        var party = CreateParty();
        var (service, _, streaming, notifier, tracker) = CreateService(party);
        streaming.Session = new PlaybackState { IsActive = true, Mode = PlaybackMode.Session };
        tracker.RegisterOrganizer("desktop", party.Id);

        var result = await service.ResetSessionAsync(party.Id);

        Assert.That(result.Kind, Is.EqualTo(AdminPartyCommandResultKind.ActiveConnectedSession));
        Assert.That(streaming.Writes, Is.Zero);
        Assert.That(notifier.Notifications, Is.Empty);
    }

    [Test]
    public async Task ResetSession_ConnectedButInactiveSession_IsAllowed()
    {
        var party = CreateParty();
        var (service, _, streaming, notifier, tracker) = CreateService(party);
        streaming.Session = new PlaybackState { IsActive = false, CurrentTrackId = "old-track", Mode = PlaybackMode.Session };
        tracker.RegisterOrganizer("desktop", party.Id);

        var result = await service.ResetSessionAsync(party.Id);

        Assert.That(result.Kind, Is.EqualTo(AdminPartyCommandResultKind.Updated));
        Assert.That(result.PlaybackState!.IsActive, Is.False);
        Assert.That(result.PlaybackState.CurrentTrackId, Is.Null);
        Assert.That(streaming.Writes, Is.EqualTo(1));
        Assert.That(notifier.Notifications, Has.Count.EqualTo(1));
    }

    [Test]
    public async Task ResetSession_AbsentOrAlreadyCleanState_IsIdempotent()
    {
        var party = CreateParty();
        var (service, _, streaming, notifier, _) = CreateService(party);

        var missing = await service.ResetSessionAsync(party.Id);
        streaming.Session = new PlaybackState { IsActive = false, Mode = PlaybackMode.Preparation, Status = PlaybackStatus.Idle };
        var clean = await service.ResetSessionAsync(party.Id);

        Assert.That(missing.Kind, Is.EqualTo(AdminPartyCommandResultKind.Unchanged));
        Assert.That(missing.PlaybackState, Is.Null);
        Assert.That(clean.Kind, Is.EqualTo(AdminPartyCommandResultKind.Unchanged));
        Assert.That(streaming.Writes, Is.Zero);
        Assert.That(notifier.Notifications, Is.Empty);
    }

    private static (AdminPartyCommandService Service, AdminPartyCommandRepository Repository,
        AdminPartyCommandStreamingRepository Streaming, RecordingResetNotifier Notifier, OrganizerConnectionTracker Tracker)
        CreateService(Party? party = null)
    {
        var actualParty = party ?? CreateParty();
        var repository = new AdminPartyCommandRepository(actualParty);
        var streaming = new AdminPartyCommandStreamingRepository();
        var tracker = new OrganizerConnectionTracker();
        var notifier = new RecordingResetNotifier();
        var service = new AdminPartyCommandService(
            repository,
            streaming,
            tracker,
            new PartyActivityCoordinator(),
            new RecordingPartyStateNotifier(),
            notifier);
        return (service, repository, streaming, notifier, tracker);
    }

    private static Party CreateParty() => new()
    {
        Id = Guid.NewGuid(),
        OrganizerId = Guid.NewGuid(),
        Name = "Session reset",
        ShortCode = "reset01",
        PartyLifecycleState = PartyLifecycleState.Ready,
        IsListedInCatalog = true
    };

    private sealed class RecordingResetNotifier : IPartySessionResetNotifier
    {
        public List<Guid> Notifications { get; } = [];

        public Task NotifySessionResetAsync(Guid partyId, PartyLifecycleState lifecycleState, PlaybackState state)
        {
            Notifications.Add(partyId);
            return Task.CompletedTask;
        }
    }
}
