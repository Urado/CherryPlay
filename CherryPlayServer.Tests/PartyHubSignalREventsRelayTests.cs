using System.Reflection;
using System.Reflection.Emit;
using System.Security.Claims;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Mappings;
using CherryPlayServer.Core.Options;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Hubs;
using CherryPlayServer.Infrastructure;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Tests;

[TestFixture]
public class PartyHubSignalREventsRelayTests
{
    private const string ShortCode = "READY1";
    private const string TrackId = "track-1";
    private const double Position = 42.5;

    private static readonly Guid PartyId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid OrganizerId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly string ConnectionId = "conn-organizer-1";
    private static readonly DateTime Now = new(2026, 5, 29, 12, 0, 0, DateTimeKind.Utc);
    private static readonly string PartyIdStr = PartyId.ToString();

    [Test]
    public async Task JoinPartyAsOrganizer_SendsOnConnectionStatusChangedTrue_ToGroup()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new FakeOrganizerTracker();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: false);

        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.StartingSoon),
            new CapturingHubContext(),
            tracker,
            jwtService: new AuthenticatingJwtService(OrganizerId));

        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await hub.JoinPartyAsOrganizer(PartyIdStr, "organizer-token");

        AssertSingleGroupMessage(hubCallerClients, "OnConnectionStatusChanged", PartyIdStr, true);
    }

    [Test]
    public async Task OnDisconnectedAsync_SendsOnConnectionStatusChangedFalse_ToGroup()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new OrganizerConnectionTracker();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: true);
        tracker.RegisterOrganizer(ConnectionId, PartyId);

        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Live),
            new CapturingHubContext(),
            tracker,
            organizerOfflineGraceSeconds: 0);

        AttachHubContext(hub, hubCallerClients, ConnectionId);

        await hub.OnDisconnectedAsync(null);

        AssertSingleGroupMessage(hubCallerClients, "OnConnectionStatusChanged", PartyIdStr, false);
    }

    [Test]
    public async Task StartSession_SendsOnSessionStarted_ToGroup()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new FakeOrganizerTracker();
        tracker.ConnectedPartyIds.Add(PartyId);
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: false);

        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Live),
            new CapturingHubContext(),
            tracker,
            streamingService: new RepositoryUpdatingStreamingService(partyRepository, streamingRepository),
            jwtService: new AuthenticatingJwtService(OrganizerId));

        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await hub.StartSession(PartyIdStr);

        AssertSingleGroupMessage(hubCallerClients, "OnSessionStarted", PartyIdStr);
    }

    [Test]
    public async Task EndSession_SendsOnSessionEnded_ToGroup()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new FakeOrganizerTracker();
        tracker.ConnectedPartyIds.Add(PartyId);
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: true);

        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.StartingSoon),
            new CapturingHubContext(),
            tracker,
            streamingService: new RepositoryUpdatingStreamingService(partyRepository, streamingRepository),
            jwtService: new AuthenticatingJwtService(OrganizerId));

        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await hub.EndSession(PartyIdStr);

        AssertSingleGroupMessage(hubCallerClients, "OnSessionEnded", PartyIdStr);
    }

    [Test]
    public async Task ResetPlaybackState_SendsOnSessionEndedAndPlaybackStateReset_ToGroup()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new FakeOrganizerTracker();
        tracker.ConnectedPartyIds.Add(PartyId);
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: true);

        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.StartingSoon),
            new CapturingHubContext(),
            tracker,
            streamingService: new RepositoryUpdatingStreamingService(partyRepository, streamingRepository),
            jwtService: new AuthenticatingJwtService(OrganizerId));

        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await hub.ResetPlaybackState(PartyIdStr);

        var messages = hubCallerClients.GroupProxy.Messages;
        Assert.That(messages.Count(m => m.Method == "OnSessionEnded"), Is.EqualTo(1));
        Assert.That(messages.Count(m => m.Method == "PlaybackStateReset"), Is.EqualTo(1));
        Assert.That(messages.Single(m => m.Method == "OnSessionEnded").Args, Is.EqualTo([PartyIdStr]));
        Assert.That(messages.Single(m => m.Method == "PlaybackStateReset").Args, Is.EqualTo([PartyIdStr]));
    }

    [Test]
    public async Task UpdateFullState_SendsOnFullStateUpdated_ToGroup()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new FakeOrganizerTracker();
        tracker.ConnectedPartyIds.Add(PartyId);
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: true);

        var stateDto = ActiveSession().ToDto()!;
        stateDto = stateDto with { Status = PlaybackStatus.Playing, CurrentTrackId = TrackId, Position = Position };

        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Live),
            new CapturingHubContext(),
            tracker,
            streamingService: new RepositoryUpdatingStreamingService(partyRepository, streamingRepository),
            jwtService: new AuthenticatingJwtService(OrganizerId));

        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await hub.UpdateFullState(PartyIdStr, stateDto);

        var messages = hubCallerClients.GroupProxy.Messages
            .Where(m => m.Method == "OnFullStateUpdated")
            .ToList();
        Assert.That(messages, Has.Count.EqualTo(1));
        Assert.That(messages[0].Args[0], Is.EqualTo(PartyIdStr));
        Assert.That(messages[0].Args[1], Is.EqualTo(stateDto));
    }

    [Test]
    public async Task UpdatePlaybackPosition_SendsOnPlaybackPositionUpdated_ToGroup()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new FakeOrganizerTracker();
        tracker.ConnectedPartyIds.Add(PartyId);
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: true);

        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Live),
            new CapturingHubContext(),
            tracker,
            streamingService: new RepositoryUpdatingStreamingService(partyRepository, streamingRepository),
            jwtService: new AuthenticatingJwtService(OrganizerId));

        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await hub.UpdatePlaybackPosition(PartyIdStr, TrackId, Position);

        AssertSingleGroupMessage(hubCallerClients, "OnPlaybackPositionUpdated", PartyIdStr, TrackId, Position);
    }

    [Test]
    public async Task NotifyStateChanged_SendsOnStateChanged_ToGroup()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new FakeOrganizerTracker();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: false);

        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Scheduled),
            new CapturingHubContext(),
            tracker,
            jwtService: new AuthenticatingJwtService(OrganizerId));

        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await hub.NotifyStateChanged(PartyIdStr);

        AssertSingleGroupMessage(hubCallerClients, "OnStateChanged", PartyIdStr);
    }

    [Test]
    public async Task NotifyPlaylistChanged_SendsOnPlaylistChanged_ToGroup()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new FakeOrganizerTracker();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: false);

        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Scheduled),
            new CapturingHubContext(),
            tracker,
            jwtService: new AuthenticatingJwtService(OrganizerId));

        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await hub.NotifyPlaylistChanged(PartyIdStr);

        AssertSingleGroupMessage(hubCallerClients, "OnPlaylistChanged", PartyIdStr);
    }

    [Test]
    public async Task JoinPartyAsViewer_SendsOnFullStateUpdated_ToCaller_WhenPlaybackExists()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var session = ActiveSession();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: false);
        await streamingRepository.SetSessionStateAsync(PartyId, session);

        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Live),
            new CapturingHubContext(),
            new FakeOrganizerTracker(),
            streamingService: new FullStateStreamingService(
                partyRepository,
                streamingRepository,
                new StubPartyDisplayStatusService(PartyDisplayStatus.Live)));

        AttachHubContext(hub, hubCallerClients, "conn-viewer-1");

        await hub.JoinPartyAsViewer(ShortCode);

        Assert.That(hubCallerClients.GroupProxy.Messages, Is.Empty);
        var callerMessages = hubCallerClients.CallerProxy.Messages
            .Where(m => m.Method == "OnFullStateUpdated")
            .ToList();
        Assert.That(callerMessages, Has.Count.EqualTo(1));
        Assert.That(callerMessages[0].Args[0], Is.EqualTo(PartyIdStr));
        Assert.That(callerMessages[0].Args[1], Is.InstanceOf<PlaybackStateDto>());
        var sentState = (PlaybackStateDto)callerMessages[0].Args[1]!;
        Assert.That(sentState.Status, Is.EqualTo(session.Status));
        Assert.That(sentState.Mode, Is.EqualTo(session.Mode));
    }

    [Test]
    public async Task RequestFullState_ReturnsPartyStateDto_WithPartyDisplayStatus()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: false);

        var displayStatusService = new StubPartyDisplayStatusService(PartyDisplayStatus.Scheduled);
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            displayStatusService,
            new CapturingHubContext(),
            new FakeOrganizerTracker(),
            streamingService: new FullStateStreamingService(
                partyRepository,
                streamingRepository,
                displayStatusService));

        AttachHubContext(hub, new CapturingHubCallerClients(), "conn-viewer-2");

        var result = await hub.RequestFullState(ShortCode);

        Assert.That(result, Is.Not.Null);
        Assert.That(result!.PartyId, Is.EqualTo(PartyIdStr));
        Assert.That(result.PartyDisplayStatus, Is.EqualTo(PartyDisplayStatus.Scheduled));
    }

    private static void AssertSingleGroupMessage(
        CapturingHubCallerClients clients,
        string method,
        params object?[] expectedArgs)
    {
        var messages = clients.GroupProxy.Messages.Where(m => m.Method == method).ToList();
        Assert.That(messages, Has.Count.EqualTo(1), $"Expected one {method} group message");
        Assert.That(messages[0].Args, Is.EqualTo(expectedArgs));
    }

    private static async Task SeedReadyPartyAsync(
        InMemoryPartyRepository partyRepository,
        InMemoryStreamingRepository streamingRepository,
        bool activeSession)
    {
        await partyRepository.AddAsync(new Party
        {
            Id = PartyId,
            OrganizerId = OrganizerId,
            Name = "Ready Party",
            ShortCode = ShortCode,
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

    private static PartyHub CreateHub(
        IPartyRepository partyRepository,
        IStreamingRepository streamingRepository,
        IPartyDisplayStatusService displayStatusService,
        CapturingHubContext hubContext,
        IOrganizerConnectionTracker organizerTracker,
        IStreamingService? streamingService = null,
        IJwtService? jwtService = null,
        int organizerOfflineGraceSeconds = 0)
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
            Options.Create(new PartyDisplayStatusOptions { OrganizerOfflineGraceSeconds = organizerOfflineGraceSeconds }),
            NullLogger<PartyHub>.Instance);
    }

    private static void AttachAuthenticatedHubContext(
        PartyHub hub,
        CapturingHubCallerClients hubCallerClients,
        string connectionId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Request.QueryString = new QueryString("?access_token=organizer-token");
        RegisterHttpContextFeature(httpContext);

        var hubCallerContext = new TestHubCallerContext(connectionId, httpContext);
        SetHubProperty(hub, "Context", hubCallerContext);
        SetHubProperty(hub, "Clients", hubCallerClients);
        SetHubProperty(hub, "Groups", new NoOpGroupManager());
    }

    private static void AttachHubContext(
        PartyHub hub,
        CapturingHubCallerClients hubCallerClients,
        string connectionId)
    {
        var hubCallerContext = new TestHubCallerContext(connectionId, httpContext: null);
        SetHubProperty(hub, "Context", hubCallerContext);
        SetHubProperty(hub, "Clients", hubCallerClients);
        SetHubProperty(hub, "Groups", new NoOpGroupManager());
    }

    private static void RegisterHttpContextFeature(HttpContext httpContext)
    {
        var interfaceType = FindHttpContextFeatureInterfaceType()
            ?? throw new InvalidOperationException("IHttpContextFeature type not found");

        var feature = CreateHttpContextFeatureInstance(httpContext, interfaceType);
        httpContext.Features[interfaceType] = feature;
    }

    private static object CreateHttpContextFeatureInstance(HttpContext httpContext, Type interfaceType)
    {
        foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies().Prepend(interfaceType.Assembly))
        {
            try
            {
                var featureType = assembly.GetTypes()
                    .FirstOrDefault(t => t.Name == "HttpContextFeature" && t.GetProperty("HttpContext") != null);
                if (featureType != null)
                {
                    var feature = Activator.CreateInstance(featureType)
                        ?? throw new InvalidOperationException("Failed to create HttpContextFeature");
                    featureType.GetProperty("HttpContext")!.SetValue(feature, httpContext);
                    return feature;
                }
            }
            catch (ReflectionTypeLoadException)
            {
            }
        }

        var assemblyName = new AssemblyName("CherryPlayServer.Tests.DynamicHttpContextFeature");
        var assemblyBuilder = AssemblyBuilder.DefineDynamicAssembly(assemblyName, AssemblyBuilderAccess.Run);
        var moduleBuilder = assemblyBuilder.DefineDynamicModule("MainModule");
        var typeBuilder = moduleBuilder.DefineType(
            "HttpContextFeatureProxy",
            TypeAttributes.Public,
            parent: null,
            interfaces: [interfaceType]);

        var httpContextField = typeBuilder.DefineField("_httpContext", typeof(HttpContext), FieldAttributes.Private);
        var propertyBuilder = typeBuilder.DefineProperty(
            "HttpContext",
            PropertyAttributes.None,
            typeof(HttpContext),
            Type.EmptyTypes);

        var getMethodBuilder = typeBuilder.DefineMethod(
            "get_HttpContext",
            MethodAttributes.Public | MethodAttributes.SpecialName | MethodAttributes.Virtual | MethodAttributes.Final | MethodAttributes.HideBySig | MethodAttributes.VtableLayoutMask,
            typeof(HttpContext),
            Type.EmptyTypes);

        var getIl = getMethodBuilder.GetILGenerator();
        getIl.Emit(OpCodes.Ldarg_0);
        getIl.Emit(OpCodes.Ldfld, httpContextField);
        getIl.Emit(OpCodes.Ret);
        propertyBuilder.SetGetMethod(getMethodBuilder);

        var setMethodBuilder = typeBuilder.DefineMethod(
            "set_HttpContext",
            MethodAttributes.Public | MethodAttributes.SpecialName | MethodAttributes.Virtual | MethodAttributes.Final | MethodAttributes.HideBySig | MethodAttributes.VtableLayoutMask,
            typeof(void),
            [typeof(HttpContext)]);

        var setIl = setMethodBuilder.GetILGenerator();
        setIl.Emit(OpCodes.Ldarg_0);
        setIl.Emit(OpCodes.Ldarg_1);
        setIl.Emit(OpCodes.Stfld, httpContextField);
        setIl.Emit(OpCodes.Ret);
        propertyBuilder.SetSetMethod(setMethodBuilder);

        var runtimeType = typeBuilder.CreateType()
            ?? throw new InvalidOperationException("Failed to create HttpContextFeature proxy type");
        var instance = Activator.CreateInstance(runtimeType)
            ?? throw new InvalidOperationException("Failed to create HttpContextFeature proxy instance");
        runtimeType.GetField("_httpContext", BindingFlags.NonPublic | BindingFlags.Instance)!
            .SetValue(instance, httpContext);
        return instance;
    }

    private static Type? FindHttpContextFeatureInterfaceType()
    {
        var typeNameCandidates = new[]
        {
            "Microsoft.AspNetCore.Http.Connections.Features.IHttpContextFeature, Microsoft.AspNetCore.Http.Connections",
            "Microsoft.AspNetCore.Http.Connections.Features.IHttpContextFeature, Microsoft.AspNetCore.Http.Connections.Abstractions",
            "Microsoft.AspNetCore.Http.Features.IHttpContextFeature, Microsoft.AspNetCore.Http.Features",
        };

        foreach (var typeName in typeNameCandidates)
        {
            var resolved = Type.GetType(typeName, throwOnError: false);
            if (resolved != null)
            {
                return resolved;
            }
        }

        foreach (var assembly in new[]
                 {
                     typeof(IHttpRequestFeature).Assembly,
                     typeof(DefaultHttpContext).Assembly,
                     typeof(PartyHub).Assembly,
                     typeof(HubCallerContext).Assembly,
                 }.Concat(AppDomain.CurrentDomain.GetAssemblies()))
        {
            try
            {
                var match = assembly.GetTypes()
                    .FirstOrDefault(t => t.Name == "IHttpContextFeature" && t.GetProperty("HttpContext") != null);
                if (match != null)
                {
                    return match;
                }
            }
            catch (ReflectionTypeLoadException ex)
            {
                var match = ex.Types.FirstOrDefault(t => t?.Name == "IHttpContextFeature");
                if (match != null)
                {
                    return match;
                }
            }
        }

        return null;
    }

    private static void SetHubProperty(Hub hub, string propertyName, object value)
    {
        var property = typeof(Hub).GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance);
        Assert.That(property, Is.Not.Null, $"Hub property {propertyName} not found");
        property!.SetValue(hub, value);
    }

    private sealed class TestHubCallerContext : HubCallerContext
    {
        public TestHubCallerContext(string connectionId, HttpContext? httpContext)
        {
            ConnectionId = connectionId;
            Features = httpContext?.Features ?? new FeatureCollection();
        }

        public override IFeatureCollection Features { get; }
        public override string ConnectionId { get; }
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
        public IGroupManager Groups => throw new NotSupportedException();

        public CapturingHubContext()
        {
            HubClients.GroupProxy = GroupProxy;
        }
    }

    private sealed class CapturingHubClients : IHubClients
    {
        public CapturingClientProxy GroupProxy { get; set; } = new();

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

    private sealed class RepositoryUpdatingStreamingService(
        IPartyRepository partyRepository,
        IStreamingRepository streamingRepository) : IStreamingService
    {
        public Task<PartyStateDto?> GetPartyStateAsync(string shortCode) => Task.FromResult<PartyStateDto?>(null);

        public async Task StartSessionAsync(Guid partyId)
        {
            var party = await partyRepository.GetByIdAsync(partyId)
                ?? throw new PartyNotFoundException(partyId);

            var existingState = await streamingRepository.GetSessionStateAsync(partyId);
            if (existingState != null)
            {
                existingState.IsActive = true;
                existingState.Mode = PlaybackMode.Session;
                existingState.SessionStartedAt = DateTime.UtcNow;
                existingState.LastUpdatedAt = DateTime.UtcNow;
                await streamingRepository.SetSessionStateAsync(partyId, existingState);
                return;
            }

            await streamingRepository.SetSessionStateAsync(partyId, new PlaybackState
            {
                Status = PlaybackStatus.Idle,
                Position = 0,
                Duration = 0,
                Volume = 0.8,
                Mode = PlaybackMode.Session,
                SessionStartedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow,
                IsActive = true,
            });
        }

        public async Task EndSessionAsync(Guid partyId)
        {
            if (await partyRepository.GetByIdAsync(partyId) == null)
            {
                throw new PartyNotFoundException(partyId);
            }

            var state = await streamingRepository.GetSessionStateAsync(partyId);
            if (state != null)
            {
                state.IsActive = false;
                state.Mode = PlaybackMode.Preparation;
                state.Status = PlaybackStatus.Ended;
                state.LastUpdatedAt = DateTime.UtcNow;
                await streamingRepository.SetSessionStateAsync(partyId, state);
            }
        }

        public async Task ResetPlaybackStateAsync(Guid partyId)
        {
            if (await partyRepository.GetByIdAsync(partyId) == null)
            {
                throw new PartyNotFoundException(partyId);
            }

            var state = await streamingRepository.GetSessionStateAsync(partyId);
            if (state == null)
            {
                state = new PlaybackState
                {
                    IsActive = false,
                    Mode = PlaybackMode.Preparation,
                    Status = PlaybackStatus.Idle,
                    LastUpdatedAt = DateTime.UtcNow,
                };
            }
            else
            {
                state.IsActive = false;
                state.Mode = PlaybackMode.Preparation;
                state.Status = PlaybackStatus.Idle;
                state.CurrentTrackId = null;
                state.Position = 0;
                state.Duration = 0;
                state.PlayedTrackIds = [];
                state.DisabledTrackIds = [];
                state.DisabledGroupIds = [];
                state.LastUpdatedAt = DateTime.UtcNow;
            }

            await streamingRepository.SetSessionStateAsync(partyId, state);
        }

        public Task UpdatePlaybackPositionAsync(Guid partyId, string trackId, double position) =>
            Task.CompletedTask;

        public async Task UpdateFullStateAsync(Guid partyId, PlaybackStateDto stateDto)
        {
            if (await partyRepository.GetByIdAsync(partyId) == null)
            {
                throw new PartyNotFoundException(partyId);
            }

            var existingState = await streamingRepository.GetSessionStateAsync(partyId);
            var state = stateDto.ToEntity();
            if (existingState != null)
            {
                state.IsActive = existingState.IsActive;
            }

            state.LastUpdatedAt = DateTime.UtcNow;
            await streamingRepository.SetSessionStateAsync(partyId, state);
        }
    }

    private sealed class FullStateStreamingService(
        IPartyRepository partyRepository,
        IStreamingRepository streamingRepository,
        IPartyDisplayStatusService displayStatusService) : IStreamingService
    {
        public async Task<PartyStateDto?> GetPartyStateAsync(string shortCode)
        {
            var party = await partyRepository.GetByShortCodeAsync(shortCode);
            if (party == null)
            {
                return null;
            }

            var state = await streamingRepository.GetSessionStateAsync(party.Id);
            var displayStatus = displayStatusService.Compute(
                party.PartyLifecycleState,
                state,
                party.Id);
            return new PartyStateDto(
                partyId: party.Id.ToString(),
                isSessionActive: state?.IsActive ?? false,
                partyDisplayStatus: displayStatus,
                playbackState: state?.ToDto(),
                playlist: party.Playlist.ToDto());
        }

        public Task StartSessionAsync(Guid partyId) => Task.CompletedTask;
        public Task EndSessionAsync(Guid partyId) => Task.CompletedTask;
        public Task ResetPlaybackStateAsync(Guid partyId) => Task.CompletedTask;
        public Task UpdatePlaybackPositionAsync(Guid partyId, string trackId, double position) => Task.CompletedTask;
        public Task UpdateFullStateAsync(Guid partyId, PlaybackStateDto stateDto) => Task.CompletedTask;
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
