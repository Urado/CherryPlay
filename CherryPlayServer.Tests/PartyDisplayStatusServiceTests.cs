using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Options;
using CherryPlayServer.Core.Services;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Tests;

[TestFixture]
public class PartyDisplayStatusServiceTests
{
    private FakeOrganizerTracker _tracker = null!;
    private PartyDisplayStatusService _service = null!;
    private static readonly Guid PartyId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly DateTime Now = new(2026, 5, 29, 12, 0, 0, DateTimeKind.Utc);

    [SetUp]
    public void SetUp()
    {
        _tracker = new FakeOrganizerTracker();
        _service = new PartyDisplayStatusService(
            _tracker,
            Options.Create(new PartyDisplayStatusOptions
            {
                OrganizerOfflineGraceSeconds = 60,
                PlaybackStaleThresholdSeconds = 30,
            }));
    }

    [Test]
    public void Compute_LifecycleDraft_ReturnsDraft()
    {
        var result = _service.Compute(PartyLifecycleState.Draft, null, PartyId, Now);
        Assert.That(result, Is.EqualTo(PartyDisplayStatus.Draft));
    }

    [Test]
    public void Compute_LifecycleCompleted_ReturnsPartyEnded()
    {
        var result = _service.Compute(PartyLifecycleState.Completed, ActiveSession(), PartyId, Now);
        Assert.That(result, Is.EqualTo(PartyDisplayStatus.PartyEnded));
    }

    [Test]
    public void Compute_SessionStoppedOrganizerConnected_ReturnsStartingSoon()
    {
        var ended = new PlaybackState
        {
            IsActive = false,
            Status = PlaybackStatus.Ended,
            LastUpdatedAt = Now,
        };
        _tracker.ConnectedPartyIds.Add(PartyId);
        var result = _service.Compute(PartyLifecycleState.Ready, ended, PartyId, Now);
        Assert.That(result, Is.EqualTo(PartyDisplayStatus.StartingSoon));
    }

    [Test]
    public void Compute_SessionStoppedOrganizerDisconnected_ReturnsScheduled()
    {
        var ended = new PlaybackState
        {
            IsActive = false,
            Status = PlaybackStatus.Ended,
            LastUpdatedAt = Now,
        };
        var result = _service.Compute(PartyLifecycleState.Ready, ended, PartyId, Now);
        Assert.That(result, Is.EqualTo(PartyDisplayStatus.Scheduled));
    }

    [Test]
    public void Compute_ReadyNoSessionOrganizerOffline_ReturnsScheduled()
    {
        var result = _service.Compute(PartyLifecycleState.Ready, null, PartyId, Now);
        Assert.That(result, Is.EqualTo(PartyDisplayStatus.Scheduled));
    }

    [Test]
    public void Compute_OrganizerConnectedNoSession_ReturnsStartingSoon()
    {
        _tracker.ConnectedPartyIds.Add(PartyId);
        var result = _service.Compute(PartyLifecycleState.Ready, null, PartyId, Now);
        Assert.That(result, Is.EqualTo(PartyDisplayStatus.StartingSoon));
    }

    [Test]
    public void Compute_ActiveSessionOrganizerConnected_ReturnsLive()
    {
        _tracker.ConnectedPartyIds.Add(PartyId);
        var result = _service.Compute(PartyLifecycleState.Ready, ActiveSession(), PartyId, Now);
        Assert.That(result, Is.EqualTo(PartyDisplayStatus.Live));
    }

    [Test]
    public void Compute_ActiveSessionOrganizerDisconnectedWithinGrace_ReturnsLive()
    {
        _tracker.DisconnectedAt[PartyId] = Now.AddSeconds(-30);
        var result = _service.Compute(PartyLifecycleState.Ready, ActiveSession(), PartyId, Now);
        Assert.That(result, Is.EqualTo(PartyDisplayStatus.Live));
    }

    [Test]
    public void Compute_ActiveSessionOrganizerDisconnectedPastGrace_ReturnsOrganizerOffline()
    {
        _tracker.DisconnectedAt[PartyId] = Now.AddSeconds(-61);
        var result = _service.Compute(PartyLifecycleState.Ready, ActiveSession(), PartyId, Now);
        Assert.That(result, Is.EqualTo(PartyDisplayStatus.OrganizerOffline));
    }

    [Test]
    public void Compute_StalePlayback_ReturnsOrganizerOffline()
    {
        _tracker.ConnectedPartyIds.Add(PartyId);
        var stale = ActiveSession();
        stale.LastUpdatedAt = Now.AddSeconds(-31);
        var result = _service.Compute(PartyLifecycleState.Ready, stale, PartyId, Now);
        Assert.That(result, Is.EqualTo(PartyDisplayStatus.OrganizerOffline));
    }

    [Test]
    public void Compute_StaleIsActivePreparationModeOrganizerConnected_ReturnsStartingSoon()
    {
        _tracker.ConnectedPartyIds.Add(PartyId);
        var stalePrep = new PlaybackState
        {
            IsActive = true,
            Mode = PlaybackMode.Preparation,
            Status = PlaybackStatus.Playing,
            LastUpdatedAt = Now.AddSeconds(-120),
        };
        var result = _service.Compute(PartyLifecycleState.Ready, stalePrep, PartyId, Now);
        Assert.That(result, Is.EqualTo(PartyDisplayStatus.StartingSoon));
    }

    [Test]
    public void Compute_ActiveSessionOrganizerNotInHubNoDisconnectRecord_ReturnsOrganizerOffline()
    {
        var result = _service.Compute(PartyLifecycleState.Ready, ActiveSession(), PartyId, Now);
        Assert.That(result, Is.EqualTo(PartyDisplayStatus.OrganizerOffline));
    }

    private static PlaybackState ActiveSession() => new()
    {
        IsActive = true,
        Mode = PlaybackMode.Session,
        Status = PlaybackStatus.Playing,
        LastUpdatedAt = Now,
    };

    private sealed class FakeOrganizerTracker : IOrganizerConnectionTracker
    {
        public HashSet<Guid> ConnectedPartyIds { get; } = [];
        public Dictionary<Guid, DateTime> DisconnectedAt { get; } = [];

        public void RegisterOrganizer(string connectionId, Guid partyId) =>
            ConnectedPartyIds.Add(partyId);

        public Guid? TryRemoveOrganizer(string connectionId) => null;

        public bool IsOrganizerConnected(Guid partyId) => ConnectedPartyIds.Contains(partyId);

        public bool TryGetOrganizerDisconnectedAt(Guid partyId, out DateTime disconnectedAt) =>
            DisconnectedAt.TryGetValue(partyId, out disconnectedAt);
    }
}
