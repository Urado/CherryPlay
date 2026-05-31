using System.Collections.Concurrent;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Options;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Hubs;
using CherryPlayServer.Infrastructure;
using CherryPlayServer.Infrastructure.Repositories;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using CherryPlayServer.Models;

namespace CherryPlayServer.Tests;

[TestFixture]
public class PartyHubGracePeriodTests
{
    private static readonly Guid PartyId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private static readonly Guid OrganizerId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static readonly string ConnectionId = "conn-organizer-grace-1";
    private static readonly string ReconnectConnectionId = "conn-organizer-grace-2";
    private static readonly DateTime Now = new(2026, 5, 29, 12, 0, 0, DateTimeKind.Utc);
    private const int GraceSeconds = 1;
    private static readonly TimeSpan GraceWait = TimeSpan.FromMilliseconds(2500);

    private static readonly JsonSerializerOptions ApiJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
    };

    [Test]
    [Category("Slow")]
    public async Task OnDisconnectedAsync_OrganizerStaysOffline_SendsSecondDisplayStatusAfterGrace()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new OrganizerConnectionTracker();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: true, organizerId: OrganizerId);
        tracker.RegisterOrganizer(ConnectionId, PartyId);

        var scopeFactory = CreateGraceScopeFactory(partyRepository, streamingRepository, tracker);
        var displayStatusService = CreateDisplayStatusService(tracker);
        var hubContext = new CapturingHubContext();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            displayStatusService,
            hubContext,
            tracker,
            scopeFactory,
            organizerOfflineGraceSeconds: GraceSeconds);

        AttachHubContext(hub, new CapturingHubCallerClients(), ConnectionId);

        await hub.OnDisconnectedAsync(null);

        var displayMessages = GetDisplayStatusMessages(hubContext);
        Assert.That(displayMessages, Has.Count.EqualTo(1));
        AssertDisplayStatusWireForm(displayMessages[0].Args[1], PartyDisplayStatus.Live, "live");

        await Task.Delay(GraceWait);

        displayMessages = GetDisplayStatusMessages(hubContext);
        Assert.That(displayMessages, Has.Count.EqualTo(2));
        Assert.That(hubContext.LastRequestedGroupName, Is.EqualTo(PartyId.ToString()));
        AssertDisplayStatusWireForm(displayMessages[1].Args[1], PartyDisplayStatus.OrganizerOffline, "organizer_offline");
    }

    [Test]
    [Category("Slow")]
    public async Task OnDisconnectedAsync_OrganizerReconnectsBeforeGrace_SendsOnlyOneDisplayStatusMessage()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new OrganizerConnectionTracker();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: true, organizerId: OrganizerId);
        tracker.RegisterOrganizer(ConnectionId, PartyId);

        var scopeFactory = CreateGraceScopeFactory(partyRepository, streamingRepository, tracker);
        var displayStatusService = CreateDisplayStatusService(tracker);
        var hubContext = new CapturingHubContext();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            displayStatusService,
            hubContext,
            tracker,
            scopeFactory,
            organizerOfflineGraceSeconds: GraceSeconds);

        AttachHubContext(hub, new CapturingHubCallerClients(), ConnectionId);

        await hub.OnDisconnectedAsync(null);

        tracker.RegisterOrganizer(ReconnectConnectionId, PartyId);

        var displayMessages = GetDisplayStatusMessages(hubContext);
        Assert.That(displayMessages, Has.Count.EqualTo(1));
        AssertDisplayStatusWireForm(displayMessages[0].Args[1], PartyDisplayStatus.Live, "live");

        await Task.Delay(GraceWait);

        displayMessages = GetDisplayStatusMessages(hubContext);
        Assert.That(displayMessages, Has.Count.EqualTo(1));
    }

    private static List<(string Method, object?[] Args)> GetDisplayStatusMessages(CapturingHubContext hubContext) =>
        hubContext.GroupProxy.Messages
            .Where(m => m.Method == "OnPartyDisplayStatusChanged")
            .ToList();

    private static IServiceScopeFactory CreateGraceScopeFactory(
        InMemoryPartyRepository partyRepository,
        InMemoryStreamingRepository streamingRepository,
        OrganizerConnectionTracker tracker)
    {
        var services = new ServiceCollection();
        services.AddSingleton<IOrganizerConnectionTracker>(tracker);
        services.AddSingleton<IPartyRepository>(partyRepository);
        services.AddSingleton<IStreamingRepository>(streamingRepository);
        services.AddSingleton<IPartyDisplayStatusService>(sp =>
            new PartyDisplayStatusService(
                sp.GetRequiredService<IOrganizerConnectionTracker>(),
                Options.Create(new PartyDisplayStatusOptions
                {
                    OrganizerOfflineGraceSeconds = GraceSeconds,
                    PlaybackStaleThresholdSeconds = 30,
                })));
        return services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
    }

    private static PartyDisplayStatusService CreateDisplayStatusService(OrganizerConnectionTracker tracker) =>
        new(
            tracker,
            Options.Create(new PartyDisplayStatusOptions
            {
                OrganizerOfflineGraceSeconds = GraceSeconds,
                PlaybackStaleThresholdSeconds = 30,
            }));

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
            Name = "Grace Period Party",
            ShortCode = "GRACE1",
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

    private static PartyHub CreateHub(
        IPartyRepository partyRepository,
        IStreamingRepository streamingRepository,
        IPartyDisplayStatusService displayStatusService,
        CapturingHubContext hubContext,
        IOrganizerConnectionTracker organizerTracker,
        IServiceScopeFactory scopeFactory,
        int organizerOfflineGraceSeconds)
    {
        return new PartyHub(
            new StubStreamingService(),
            new PartyIdValidator(),
            new StubJwtService(),
            new StubPartyAccessService(),
            organizerTracker,
            partyRepository,
            streamingRepository,
            displayStatusService,
            hubContext,
            scopeFactory,
            Options.Create(new PartyDisplayStatusOptions { OrganizerOfflineGraceSeconds = organizerOfflineGraceSeconds }),
            NullLogger<PartyHub>.Instance);
    }

    private static void AttachHubContext(
        PartyHub hub,
        CapturingHubCallerClients hubCallerClients,
        string connectionId)
    {
        var hubCallerContext = new TestHubCallerContext(connectionId);
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

    private sealed class TestHubCallerContext : HubCallerContext
    {
        public TestHubCallerContext(string connectionId) => ConnectionId = connectionId;

        public override Microsoft.AspNetCore.Http.Features.IFeatureCollection Features { get; } =
            new Microsoft.AspNetCore.Http.Features.FeatureCollection();

        public override string ConnectionId { get; }
        public override string? UserIdentifier => null;
        public override System.Security.Claims.ClaimsPrincipal? User => null;
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
        private readonly ConcurrentQueue<(string Method, object?[] Args)> _messages = new();

        public IEnumerable<(string Method, object?[] Args)> Messages => _messages;

        public Task SendCoreAsync(string methodName, object?[] args, CancellationToken cancellationToken = default)
        {
            _messages.Enqueue((methodName, args));
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
}
