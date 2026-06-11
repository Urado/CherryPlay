using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Options;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Hubs;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Models;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Tests;

[TestFixture]
public class PartyHubDisplayStatusRelayTests
{
    private static readonly Guid PartyId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid OrganizerId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly DateTime Now = new(2026, 5, 29, 12, 0, 0, DateTimeKind.Utc);

    private static readonly JsonSerializerOptions ApiJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
    };

    [Test]
    public async Task NotifyPartyDisplayStatusChanged_SendsOnPartyDisplayStatusChanged_ToPartyGroup_WithSnakeCaseWireValue()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new FakeOrganizerTracker();
        tracker.ConnectedPartyIds.Add(PartyId);
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: true);

        var hubContext = new CapturingHubContext();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            CreateDisplayStatusService(tracker),
            hubContext,
            tracker);

        await InvokeNotifyPartyDisplayStatusChangedAsync(hub, PartyId);

        Assert.That(hubContext.LastRequestedGroupName, Is.EqualTo(PartyId.ToString()));
        Assert.That(hubContext.GroupProxy.Messages, Has.Count.EqualTo(1));
        var (method, args) = hubContext.GroupProxy.Messages[0];
        Assert.That(method, Is.EqualTo("OnPartyDisplayStatusChanged"));
        Assert.That(args, Has.Length.EqualTo(2));
        Assert.That(args[0], Is.EqualTo(PartyId.ToString()));
        AssertDisplayStatusWireForm(args[1], PartyDisplayStatus.Live, "live");
    }

    [Test]
    public async Task NotifyPartyDisplayStatusChanged_DoesNotSend_WhenPartyNotFound()
    {
        var hubContext = new CapturingHubContext();
        var hub = CreateHub(
            new InMemoryPartyRepository(),
            new InMemoryStreamingRepository(),
            CreateDisplayStatusService(new FakeOrganizerTracker()),
            hubContext,
            new FakeOrganizerTracker());

        await InvokeNotifyPartyDisplayStatusChangedAsync(hub, PartyId);

        Assert.That(hubContext.GroupProxy.Messages, Is.Empty);
        Assert.That(hubContext.LastRequestedGroupName, Is.Null);
    }

    [Test]
    public async Task NotifyPartyDisplayStatusChanged_SendsDraft_ForDraftLifecycle()
    {
        var partyRepository = new InMemoryPartyRepository();
        await partyRepository.AddAsync(new Party
        {
            Id = PartyId,
            OrganizerId = OrganizerId,
            Name = "Draft Party",
            ShortCode = "DRAFT1",
            PartyThemeId = PartyThemeId.Basic,
            Playlist = new PartyPlaylist(),
            CreatedAt = Now,
            PartyLifecycleState = PartyLifecycleState.Draft,
        });

        var hubContext = new CapturingHubContext();
        var hub = CreateHub(
            partyRepository,
            new InMemoryStreamingRepository(),
            CreateDisplayStatusService(new FakeOrganizerTracker()),
            hubContext,
            new FakeOrganizerTracker());

        await InvokeNotifyPartyDisplayStatusChangedAsync(hub, PartyId);

        Assert.That(hubContext.GroupProxy.Messages, Has.Count.EqualTo(1));
        Assert.That(hubContext.LastRequestedGroupName, Is.EqualTo(PartyId.ToString()));
        AssertDisplayStatusWireForm(hubContext.GroupProxy.Messages[0].Args[1], PartyDisplayStatus.Draft, "draft");
    }

    [Test]
    public async Task NotifyPartyDisplayStatusChanged_UsesStubbedComputeResult()
    {
        var partyRepository = new InMemoryPartyRepository();
        await partyRepository.AddAsync(new Party
        {
            Id = PartyId,
            OrganizerId = OrganizerId,
            Name = "Ready Party",
            ShortCode = "READY1",
            PartyThemeId = PartyThemeId.Basic,
            Playlist = new PartyPlaylist(),
            CreatedAt = Now,
            PartyLifecycleState = PartyLifecycleState.Ready,
        });

        var hubContext = new CapturingHubContext();
        var stubService = new StubPartyDisplayStatusService(PartyDisplayStatus.OrganizerOffline);
        var hub = CreateHub(
            partyRepository,
            new InMemoryStreamingRepository(),
            stubService,
            hubContext,
            new FakeOrganizerTracker());

        await InvokeNotifyPartyDisplayStatusChangedAsync(hub, PartyId);

        Assert.That(hubContext.GroupProxy.Messages, Has.Count.EqualTo(1));
        AssertDisplayStatusWireForm(
            hubContext.GroupProxy.Messages[0].Args[1],
            PartyDisplayStatus.OrganizerOffline,
            "organizer_offline");
    }

    [Test]
    public async Task JoinPartyAsOrganizer_SendsOnPartyDisplayStatusChanged_ToPartyGroup()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new FakeOrganizerTracker();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: false, organizerId: OrganizerId);

        var hubContext = new CapturingHubContext();
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            CreateDisplayStatusService(tracker),
            hubContext,
            tracker,
            jwtService: new AuthenticatingJwtService(OrganizerId));

        AttachHubContext(hub, hubCallerClients);

        await hub.JoinPartyAsOrganizer(PartyId.ToString(), "organizer-token");

        Assert.That(tracker.ConnectedPartyIds, Contains.Item(PartyId));
        Assert.That(hubContext.GroupProxy.Messages, Has.Some.Matches<(string Method, object?[] Args)>(
            m => m.Method == "OnPartyDisplayStatusChanged"));
        var displayMessage = hubContext.GroupProxy.Messages.Single(m => m.Method == "OnPartyDisplayStatusChanged");
        Assert.That(hubContext.LastRequestedGroupName, Is.EqualTo(PartyId.ToString()));
        Assert.That(displayMessage.Args[0], Is.EqualTo(PartyId.ToString()));
        AssertDisplayStatusWireForm(displayMessage.Args[1], PartyDisplayStatus.StartingSoon, "starting_soon");
    }

    private static async Task SeedReadyPartyAsync(
        InMemoryPartyRepository partyRepository,
        InMemoryStreamingRepository streamingRepository,
        bool activeSession,
        Guid? organizerId = null)
    {
        await partyRepository.AddAsync(new Party
        {
            Id = PartyId,
            OrganizerId = organizerId ?? Guid.NewGuid(),
            Name = "Ready Party",
            ShortCode = "READY1",
            PartyThemeId = PartyThemeId.Basic,
            Playlist = new PartyPlaylist(),
            CreatedAt = Now,
            PartyLifecycleState = PartyLifecycleState.Ready,
        });

        if (activeSession)
        {
            await streamingRepository.SetSessionStateAsync(PartyId, ActiveSession());
        }
    }

    private static PlaybackState ActiveSession() => new()
    {
        IsActive = true,
        Mode = PlaybackMode.Session,
        Status = PlaybackStatus.Playing,
        LastUpdatedAt = DateTime.UtcNow,
    };

    private static void AssertDisplayStatusWireForm(
        object? arg,
        PartyDisplayStatus expectedEnum,
        string expectedSnake)
    {
        Assert.That(arg, Is.EqualTo(expectedEnum));
        var json = JsonSerializer.Serialize(arg, ApiJsonOptions);
        Assert.That(json, Is.EqualTo($"\"{expectedSnake}\""));
    }

    private static PartyDisplayStatusService CreateDisplayStatusService(FakeOrganizerTracker tracker) =>
        new(
            tracker,
            Options.Create(new PartyDisplayStatusOptions
            {
                OrganizerOfflineGraceSeconds = 60,
                PlaybackStaleThresholdSeconds = 30,
            }));

    private static PartyHub CreateHub(
        IPartyRepository partyRepository,
        IStreamingRepository streamingRepository,
        IPartyDisplayStatusService displayStatusService,
        CapturingHubContext hubContext,
        FakeOrganizerTracker organizerTracker,
        IStreamingService? streamingService = null,
        IJwtService? jwtService = null)
    {
        return new PartyHub(
            streamingService ?? new StubStreamingService(),
            new PartyIdValidator(),
            jwtService ?? new StubJwtService(),
            new StubPartyAccessService(),
            organizerTracker,
            partyRepository,
            streamingRepository,
            displayStatusService,
            hubContext,
            new StubScopeFactory(),
            Options.Create(new PartyDisplayStatusOptions { OrganizerOfflineGraceSeconds = 0 }),
            NullLogger<PartyHub>.Instance);
    }

    private static void AttachHubContext(PartyHub hub, CapturingHubCallerClients hubCallerClients)
    {
        var hubCallerContext = new TestHubCallerContext("conn-1");
        SetHubProperty(hub, "Context", hubCallerContext);
        SetHubProperty(hub, "Clients", hubCallerClients);
        SetHubProperty(hub, "Groups", new NoOpGroupManager());
    }

    private static void SetHubProperty(Hub hub, string propertyName, object value)
    {
        var property = typeof(Hub).GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance);
        Assert.That(property, Is.Not.Null, $"Hub property {propertyName} not found");
        property!.SetValue(hub, value);
    }

    private static Task InvokeNotifyPartyDisplayStatusChangedAsync(PartyHub hub, Guid partyId)
    {
        var method = typeof(PartyHub).GetMethod(
            "NotifyPartyDisplayStatusChangedAsync",
            BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.That(method, Is.Not.Null);
        return (Task)method!.Invoke(hub, [partyId])!;
    }

    private sealed class TestHubCallerContext(string connectionId) : HubCallerContext
    {
        public override IFeatureCollection Features { get; } = new FeatureCollection();
        public override string ConnectionId { get; } = connectionId;
        public override string? UserIdentifier => null;
        public override ClaimsPrincipal? User => null;
        public override IDictionary<object, object?> Items { get; } = new Dictionary<object, object?>();
        public override CancellationToken ConnectionAborted => CancellationToken.None;

        public override void Abort() { }
    }

    private sealed class CapturingHubContext : IHubContext<PartyHub>
    {
        public CapturingClientProxy GroupProxy { get; } = new();
        public CapturingHubClients HubClients { get; } = new();
        public IHubClients Clients => HubClients;
        public string? LastRequestedGroupName => HubClients.LastGroupName;
        public IGroupManager Groups => throw new NotSupportedException();

        public CapturingHubContext()
        {
            HubClients.GroupProxy = GroupProxy;
        }
    }

    private sealed class CapturingHubClients : IHubClients
    {
        public CapturingClientProxy GroupProxy { get; set; } = new();
        public string? LastGroupName { get; private set; }

        public IClientProxy All => throw new NotSupportedException();
        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => throw new NotSupportedException();
        public IClientProxy Client(string connectionId) => throw new NotSupportedException();
        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => throw new NotSupportedException();

        public IClientProxy Group(string groupName)
        {
            LastGroupName = groupName;
            return GroupProxy;
        }

        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) =>
            throw new NotSupportedException();
        public IClientProxy Groups(IReadOnlyList<string> groupNames) => throw new NotSupportedException();
        public IClientProxy User(string userId) => throw new NotSupportedException();
        public IClientProxy Users(IReadOnlyList<string> userIds) => throw new NotSupportedException();
    }

    private sealed class CapturingHubCallerClients : IHubCallerClients
    {
        public CapturingClientProxy CallerProxy { get; } = new();
        public CapturingClientProxy GroupProxy { get; set; } = new();

        public IClientProxy Caller => CallerProxy;
        public IClientProxy Others => throw new NotSupportedException();
        public IClientProxy OthersInGroup(string groupName) => throw new NotSupportedException();

        public IClientProxy All => throw new NotSupportedException();
        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => throw new NotSupportedException();
        public IClientProxy Client(string connectionId) => throw new NotSupportedException();
        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => throw new NotSupportedException();
        public IClientProxy Group(string groupName) => GroupProxy;
        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) =>
            throw new NotSupportedException();
        public IClientProxy Groups(IReadOnlyList<string> groupNames) => throw new NotSupportedException();
        public IClientProxy User(string userId) => throw new NotSupportedException();
        public IClientProxy Users(IReadOnlyList<string> userIds) => throw new NotSupportedException();
    }

    private sealed class CapturingClientProxy : IClientProxy
    {
        public List<(string Method, object?[] Args)> Messages { get; } = [];

        public Task SendCoreAsync(string methodName, object?[] args, CancellationToken cancellationToken = default)
        {
            Messages.Add((methodName, args));
            return Task.CompletedTask;
        }
    }

    private sealed class NoOpGroupManager : IGroupManager
    {
        public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class AuthenticatingJwtService(Guid organizerId) : IJwtService
    {
        public Task<string> GenerateTokenAsync(Guid organizerId, string name, Guid sessionId, string role) =>
            Task.FromResult("token");

        public Task<JwtTokenValidationResult> ValidateTokenAsync(string token) =>
            Task.FromResult(new JwtTokenValidationResult(true, organizerId, Guid.NewGuid(), "Test Organizer", "organizer", null));

        public Task<Guid?> GetOrganizerIdFromTokenAsync(string token) => Task.FromResult<Guid?>(organizerId);
    }

    private sealed class StubStreamingService : IStreamingService
    {
        public Task<PartyStateDto?> GetPartyStateAsync(string shortCode) => Task.FromResult<PartyStateDto?>(null);
        public Task StartSessionAsync(Guid partyId) => Task.CompletedTask;
        public Task EndSessionAsync(Guid partyId) => Task.CompletedTask;
        public Task ResetPlaybackStateAsync(Guid partyId) => Task.CompletedTask;
        public Task UpdatePlaybackPositionAsync(Guid partyId, string trackId, double position) => Task.CompletedTask;
        public Task UpdateFullStateAsync(Guid partyId, PlaybackStateDto stateDto) => Task.CompletedTask;
    }

    private sealed class StubJwtService : IJwtService
    {
        public Task<string> GenerateTokenAsync(Guid organizerId, string name, Guid sessionId, string role) =>
            Task.FromResult("token");

        public Task<JwtTokenValidationResult> ValidateTokenAsync(string token) =>
            Task.FromResult(new JwtTokenValidationResult(false, null, null, null, null, null));

        public Task<Guid?> GetOrganizerIdFromTokenAsync(string token) => Task.FromResult<Guid?>(null);
    }

    private sealed class StubPartyAccessService : IPartyAccessService
    {
        public Task EnsurePartyOwnershipAsync(Guid partyId, Guid organizerId) => Task.CompletedTask;
    }

    private sealed class StubScopeFactory : IServiceScopeFactory
    {
        public IServiceScope CreateScope() => new StubScope();

        private sealed class StubScope : IServiceScope
        {
            public IServiceProvider ServiceProvider => NullServiceProvider.Instance;
            public void Dispose() { }
        }

        private sealed class NullServiceProvider : IServiceProvider
        {
            public static readonly NullServiceProvider Instance = new();
            public object? GetService(Type serviceType) => null;
        }
    }
}
