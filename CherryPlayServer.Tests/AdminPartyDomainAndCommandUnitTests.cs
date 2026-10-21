using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Options;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class AdminPartyDomainAndCommandUnitTests
{
    [TestCase(PartyLifecycleState.Draft, PartyLifecycleState.Draft)]
    [TestCase(PartyLifecycleState.Draft, PartyLifecycleState.Ready)]
    [TestCase(PartyLifecycleState.Draft, PartyLifecycleState.Completed)]
    [TestCase(PartyLifecycleState.Ready, PartyLifecycleState.Draft)]
    [TestCase(PartyLifecycleState.Ready, PartyLifecycleState.Ready)]
    [TestCase(PartyLifecycleState.Ready, PartyLifecycleState.Completed)]
    [TestCase(PartyLifecycleState.Completed, PartyLifecycleState.Draft)]
    [TestCase(PartyLifecycleState.Completed, PartyLifecycleState.Ready)]
    [TestCase(PartyLifecycleState.Completed, PartyLifecycleState.Completed)]
    public void AdministratorLifecycleOperation_AcceptsEveryTransition(
        PartyLifecycleState source,
        PartyLifecycleState target)
    {
        var party = CreateParty(source);

        party.SetLifecycleForAdministrator(target);

        Assert.That(party.PartyLifecycleState, Is.EqualTo(target));
    }

    [TestCase(PartyLifecycleState.Draft, PartyLifecycleState.Draft, true)]
    [TestCase(PartyLifecycleState.Draft, PartyLifecycleState.Ready, true)]
    [TestCase(PartyLifecycleState.Draft, PartyLifecycleState.Completed, false)]
    [TestCase(PartyLifecycleState.Ready, PartyLifecycleState.Draft, false)]
    [TestCase(PartyLifecycleState.Ready, PartyLifecycleState.Ready, true)]
    [TestCase(PartyLifecycleState.Ready, PartyLifecycleState.Completed, true)]
    [TestCase(PartyLifecycleState.Completed, PartyLifecycleState.Draft, false)]
    [TestCase(PartyLifecycleState.Completed, PartyLifecycleState.Ready, true)]
    [TestCase(PartyLifecycleState.Completed, PartyLifecycleState.Completed, true)]
    public void OrganizerLifecycleOperation_PreservesUserTransitionRules(
        PartyLifecycleState source,
        PartyLifecycleState target,
        bool allowed)
    {
        var party = CreateParty(source);

        if (allowed)
        {
            Assert.DoesNotThrow(() => party.TransitionLifecycleForOrganizer(target));
            Assert.That(party.PartyLifecycleState, Is.EqualTo(target));
        }
        else
        {
            Assert.Throws<CherryPlayServer.Core.Exceptions.InvalidPartyLifecycleTransitionException>(
                () => party.TransitionLifecycleForOrganizer(target));
            Assert.That(party.PartyLifecycleState, Is.EqualTo(source));
        }
    }

    [TestCase(false, false, AdminPartyCommandResultKind.Updated)]
    [TestCase(false, true, AdminPartyCommandResultKind.Updated)]
    [TestCase(true, false, AdminPartyCommandResultKind.Updated)]
    [TestCase(true, true, AdminPartyCommandResultKind.ActiveConnectedSession)]
    public async Task CommandService_GuardsOnlyActiveConnectedLifecycleChanges(
        bool sessionActive,
        bool desktopConnected,
        AdminPartyCommandResultKind expectedKind)
    {
        var (service, repository, streamingRepository, tracker, notifier, partyId) = CreateService();
        if (sessionActive)
        {
            streamingRepository.Session = new PlaybackState { IsActive = true };
        }
        if (desktopConnected)
        {
            tracker.RegisterOrganizer($"connection-{partyId:N}", partyId);
        }

        var result = await service.SetLifecycleStateAsync(partyId, PartyLifecycleState.Completed);
        var saved = repository.Party;

        Assert.That(result.Kind, Is.EqualTo(expectedKind));
        Assert.That(saved!.PartyLifecycleState, Is.EqualTo(
            expectedKind == AdminPartyCommandResultKind.ActiveConnectedSession
                ? PartyLifecycleState.Ready
                : PartyLifecycleState.Completed));
        Assert.That(notifier.Notifications, Has.Count.EqualTo(expectedKind == AdminPartyCommandResultKind.Updated ? 1 : 0));
        Assert.That(repository.LifecycleWrites, Is.EqualTo(expectedKind == AdminPartyCommandResultKind.Updated ? 1 : 0));
    }

    [Test]
    public async Task CommandService_VisibilityChangeRemainsAvailableDuringActiveConnectedSession()
    {
        var (service, repository, streamingRepository, tracker, notifier, partyId) = CreateService();
        streamingRepository.Session = new PlaybackState { IsActive = true };
        tracker.RegisterOrganizer($"connection-{partyId:N}", partyId);

        var result = await service.SetCatalogVisibilityAsync(partyId, false);
        var saved = repository.Party;

        Assert.That(result.Kind, Is.EqualTo(AdminPartyCommandResultKind.Updated));
        Assert.That(saved!.IsListedInCatalog, Is.False);
        Assert.That(saved.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
        Assert.That(notifier.Notifications, Is.Empty);
        Assert.That(repository.VisibilityWrites, Is.EqualTo(1));
    }

    [Test]
    public async Task CommandService_IdempotentLifecycleChangeDoesNotNotify()
    {
        var (service, repository, _, _, notifier, partyId) = CreateService();

        var result = await service.SetLifecycleStateAsync(partyId, PartyLifecycleState.Ready);

        Assert.That(result.Kind, Is.EqualTo(AdminPartyCommandResultKind.Unchanged));
        Assert.That(repository.Party.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
        Assert.That(notifier.Notifications, Is.Empty);
        Assert.That(repository.LifecycleWrites, Is.Zero);
    }

    [Test]
    public void CommandService_RejectsUndefinedLifecycleWithoutWritesOrNotifications()
    {
        var (service, repository, _, _, notifier, partyId) = CreateService();

        Assert.ThrowsAsync<ArgumentOutOfRangeException>(() => service.SetLifecycleStateAsync(partyId, (PartyLifecycleState)999));

        Assert.That(repository.Party.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
        Assert.That(repository.LifecycleWrites, Is.Zero);
        Assert.That(notifier.Notifications, Is.Empty);
    }

    [Test]
    public async Task StartSessionAndAdminLifecycleCommand_UseTheSameCoordinator()
    {
        var party = CreateParty(PartyLifecycleState.Ready);
        var parties = new InMemoryPartyRepository();
        await parties.AddAsync(party);
        var streaming = new BlockingStartStreamingRepository();
        var tracker = new OrganizerConnectionTracker();
        tracker.RegisterOrganizer("desktop", party.Id);
        var coordinator = new PartyActivityCoordinator();
        var notifier = new RecordingPartyStateNotifier();
        var commandRepository = new AdminPartyCommandRepository(party);
        var commandService = new AdminPartyCommandService(
            commandRepository,
            streaming,
            tracker,
            coordinator,
            notifier,
            new EmptySessionResetNotifier());
        var streamingService = new StreamingService(
            parties,
            streaming,
            new EmptyPlaylistTrackFinder(),
            new PartyDisplayStatusService(tracker, Options.Create(new PartyDisplayStatusOptions())),
            NullLogger<StreamingService>.Instance,
            coordinator);

        var startSession = streamingService.StartSessionAsync(party.Id);
        await streaming.StartWriteEntered.Task;
        var adminChange = commandService.SetLifecycleStateAsync(party.Id, PartyLifecycleState.Completed);
        await Task.Yield();
        Assert.That(commandRepository.LifecycleWrites, Is.Zero);

        streaming.AllowWrite.TrySetResult();
        await startSession;
        var result = await adminChange;

        Assert.That(streaming.Session?.IsActive, Is.True);
        Assert.That(result.Kind, Is.EqualTo(AdminPartyCommandResultKind.ActiveConnectedSession));
        Assert.That(commandRepository.LifecycleWrites, Is.Zero);
    }

    [Test]
    public async Task ActivityCoordinator_ReleasesPartyGateAfterFailureAndCancellation()
    {
        var coordinator = new PartyActivityCoordinator();
        var partyId = Guid.NewGuid();
        Assert.ThrowsAsync<InvalidOperationException>(() => coordinator.ExecuteAsync<int>(
            partyId,
            () => throw new InvalidOperationException("expected")));

        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        Assert.ThrowsAsync<TaskCanceledException>(() => coordinator.ExecuteAsync<int>(
            partyId,
            () => Task.FromResult(1),
            cancellation.Token));
        var value = await coordinator.ExecuteAsync(partyId, () => Task.FromResult(2));

        Assert.That(value, Is.EqualTo(2));
    }

    private static Party CreateParty(PartyLifecycleState state) => new()
    {
        Id = Guid.NewGuid(),
        OrganizerId = Guid.NewGuid(),
        Name = "Unit party",
        ShortCode = Guid.NewGuid().ToString("N")[..7],
        PartyLifecycleState = state,
        IsListedInCatalog = true
    };

    [Test]
    public void DeletedParty_DomainOperationsAreReadOnly()
    {
        var party = CreateParty(PartyLifecycleState.Ready);
        party.MarkAsDeleted();

        Assert.Throws<InvalidOperationException>(() => party.SetLifecycleForAdministrator(PartyLifecycleState.Draft));
        Assert.Throws<InvalidOperationException>(() => party.SetCatalogVisibility(false));
        Assert.That(party.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
        Assert.That(party.IsListedInCatalog, Is.True);
    }

    private static (
        AdminPartyCommandService Service,
        AdminPartyCommandRepository Parties,
        AdminPartyCommandStreamingRepository Streaming,
        OrganizerConnectionTracker Tracker,
        RecordingPartyStateNotifier Notifier,
        Guid PartyId) CreateService()
    {
        var party = CreateParty(PartyLifecycleState.Ready);
        var parties = new AdminPartyCommandRepository(party);
        var streaming = new AdminPartyCommandStreamingRepository();
        var tracker = new OrganizerConnectionTracker();
        var notifier = new RecordingPartyStateNotifier();
        var service = new AdminPartyCommandService(
            parties,
            streaming,
            tracker,
            new PartyActivityCoordinator(),
            notifier,
            new EmptySessionResetNotifier());
        return (service, parties, streaming, tracker, notifier, party.Id);
    }

    private sealed class EmptyPlaylistTrackFinder : IPlaylistTrackFinder
    {
        public double? FindTrackDuration(List<PlayerItem> items, string trackId) => null;
    }

    private sealed class EmptySessionResetNotifier : IPartySessionResetNotifier
    {
        public Task NotifySessionResetAsync(Guid partyId, PartyLifecycleState lifecycleState, PlaybackState state) =>
            Task.CompletedTask;
    }

    private sealed class BlockingStartStreamingRepository : IStreamingRepository
    {
        private readonly TaskCompletionSource _startWriteEntered = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource _allowWrite = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public TaskCompletionSource StartWriteEntered => _startWriteEntered;
        public TaskCompletionSource AllowWrite => _allowWrite;
        public PlaybackState? Session { get; private set; }

        public Task<PlaybackState?> GetSessionStateAsync(Guid partyId) => Task.FromResult(Session);

        public async Task SetSessionStateAsync(Guid partyId, PlaybackState state)
        {
            _startWriteEntered.TrySetResult();
            await _allowWrite.Task;
            Session = state;
        }

        public Task DeleteSessionStateAsync(Guid partyId)
        {
            Session = null;
            return Task.CompletedTask;
        }

        public Task<Dictionary<Guid, PlaybackState>> GetAllSessionStatesAsync() =>
            Task.FromResult(Session is null ? new Dictionary<Guid, PlaybackState>() : new Dictionary<Guid, PlaybackState>());
    }
}
