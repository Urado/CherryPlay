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
public class PartyHubNegativeAndEdgeCasesTests
{
    private const string ShortCode = "READY1";
    private const string TrackId = "track-1";
    private const double Position = 42.5;
    private const string InvalidPartyId = "not-a-valid-guid";
    private const string ValidToken = "valid-token";

    private static readonly Guid PartyId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid OrganizerId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly string ConnectionId = "conn-organizer-1";
    private static readonly DateTime Now = new(2026, 5, 29, 12, 0, 0, DateTimeKind.Utc);
    private static readonly string PartyIdStr = PartyId.ToString();

    #region §4.1 Auth / ownership

    [Test]
    public async Task StartSession_WithoutJwt_SendsAuthenticationRequired_NoGroupRelay()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(new FakeOrganizerTracker());
        AttachHubContext(hub, hubCallerClients, ConnectionId);

        await hub.StartSession(PartyIdStr);

        AssertCallerError(hubCallerClients, "Authentication required");
    }

    private static IEnumerable<TestCaseData> OrganizerMethodsRequiringAuthCases()
    {
        yield return new TestCaseData("UpdateFullState").SetName("UpdateFullState_WithoutJwt");
        yield return new TestCaseData("UpdatePlaybackPosition").SetName("UpdatePlaybackPosition_WithoutJwt");
        yield return new TestCaseData("EndSession").SetName("EndSession_WithoutJwt");
        yield return new TestCaseData("ResetPlaybackState").SetName("ResetPlaybackState_WithoutJwt");
        yield return new TestCaseData("NotifyStateChanged").SetName("NotifyStateChanged_WithoutJwt");
        yield return new TestCaseData("NotifyPlaylistChanged").SetName("NotifyPlaylistChanged_WithoutJwt");
    }

    [TestCaseSource(nameof(OrganizerMethodsRequiringAuthCases))]
    public async Task OrganizerMethod_WithoutJwt_SendsAuthenticationRequired_NoGroupRelay(string methodName)
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(new FakeOrganizerTracker());
        AttachHubContext(hub, hubCallerClients, ConnectionId);

        await InvokeOrganizerMethodAsync(hub, methodName);

        AssertCallerError(hubCallerClients, "Authentication required");
    }

    [Test]
    public async Task JoinPartyAsOrganizer_EmptyTokenWithFailingJwt_SendsAuthenticationTokenRequired_NoGroupRelay()
    {
        // Empty token returns before JWT validation; FailingJwtService is never invoked.
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(new FakeOrganizerTracker(), jwtService: new FailingJwtService());
        AttachHubContext(hub, hubCallerClients, ConnectionId);

        await hub.JoinPartyAsOrganizer(PartyIdStr, "");

        AssertCallerError(hubCallerClients, "Authentication token is required");
    }

    [Test]
    public async Task JoinPartyAsOrganizer_ParameterTokenOnly_RegistersOrganizer_NoAuthError()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new OrganizerConnectionTracker();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: false);

        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Scheduled),
            new CapturingHubContext(),
            tracker,
            jwtService: new AuthenticatingJwtService(OrganizerId));

        AttachHubContext(hub, hubCallerClients, ConnectionId);

        await hub.JoinPartyAsOrganizer(PartyIdStr, ValidToken);

        Assert.That(
            hubCallerClients.CallerProxy.Messages.Where(m => m.Method == "Error"),
            Is.Empty,
            "Should not send auth error when token parameter is valid");
    }

    [Test]
    public async Task StartSession_PartyNotFoundViaAccessService_SendsPartyNotFound_NoGroupRelay()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(
            new FakeOrganizerTracker(),
            jwtService: new AuthenticatingJwtService(OrganizerId),
            partyAccessService: new ThrowingPartyAccessService(new PartyNotFoundException(PartyId)));
        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await hub.StartSession(PartyIdStr);

        AssertCallerError(hubCallerClients, "Party not found");
    }

    [Test]
    public async Task StartSession_ForbiddenViaAccessService_SendsPermissionDenied_NoGroupRelay()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(
            new FakeOrganizerTracker(),
            jwtService: new AuthenticatingJwtService(OrganizerId),
            partyAccessService: new ThrowingPartyAccessService(new ForbiddenException("denied")));
        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await hub.StartSession(PartyIdStr);

        AssertCallerError(hubCallerClients, "You do not have permission to access this party");
    }

    #endregion

    #region §4.2 Validation errors

    [TestCase("")]
    [TestCase("   ")]
    public async Task JoinPartyAsViewer_EmptyShortCode_SendsShortCodeCannotBeEmpty_NoGroupRelay(string shortCode)
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(new FakeOrganizerTracker());
        AttachHubContext(hub, hubCallerClients, "conn-viewer");

        await hub.JoinPartyAsViewer(shortCode);

        AssertCallerError(hubCallerClients, "Short code cannot be empty");
    }

    [Test]
    public async Task JoinPartyAsViewerWithState_EmptyShortCode_SendsShortCodeCannotBeEmpty()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(new FakeOrganizerTracker());
        AttachHubContext(hub, hubCallerClients, "conn-viewer");

        var result = await hub.JoinPartyAsViewerWithState("");

        Assert.That(result, Is.Null);
        AssertCallerError(hubCallerClients, "Short code cannot be empty");
    }

    [Test]
    public async Task RequestFullState_EmptyShortCode_SendsShortCodeCannotBeEmpty()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(new FakeOrganizerTracker());
        AttachHubContext(hub, hubCallerClients, "conn-viewer");

        var result = await hub.RequestFullState("  ");

        Assert.That(result, Is.Null);
        AssertCallerError(hubCallerClients, "Short code cannot be empty");
    }

    private static IEnumerable<TestCaseData> InvalidPartyIdOrganizerMethodCases()
    {
        yield return new TestCaseData("UpdatePlaybackPosition").SetName("UpdatePlaybackPosition_InvalidPartyId");
        yield return new TestCaseData("UpdateFullState").SetName("UpdateFullState_InvalidPartyId");
        yield return new TestCaseData("JoinPartyAsOrganizer").SetName("JoinPartyAsOrganizer_InvalidPartyId");
        yield return new TestCaseData("StartSession").SetName("StartSession_InvalidPartyId");
    }

    [TestCaseSource(nameof(InvalidPartyIdOrganizerMethodCases))]
    public async Task OrganizerMethod_InvalidPartyId_SendsInvalidPartyIdFormat_NoGroupRelay(string methodName)
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(new FakeOrganizerTracker(), jwtService: new AuthenticatingJwtService(OrganizerId));
        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await InvokeOrganizerMethodAsync(hub, methodName, InvalidPartyId);

        AssertCallerError(hubCallerClients, "Invalid party ID format");
    }

    [Test]
    public async Task UpdatePlaybackPosition_EmptyTrackId_SendsTrackIdCannotBeEmpty_NoGroupRelay()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(new FakeOrganizerTracker(), jwtService: new AuthenticatingJwtService(OrganizerId));
        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await hub.UpdatePlaybackPosition(PartyIdStr, "", Position);

        AssertCallerError(hubCallerClients, "Track ID cannot be empty");
    }

    [Test]
    public async Task UpdatePlaybackPosition_NegativePosition_SendsPositionCannotBeNegative_NoGroupRelay()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(new FakeOrganizerTracker(), jwtService: new AuthenticatingJwtService(OrganizerId));
        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await hub.UpdatePlaybackPosition(PartyIdStr, TrackId, -1);

        AssertCallerError(hubCallerClients, "Position cannot be negative");
    }

    [Test]
    public async Task UpdateFullState_NullState_SendsStateCannotBeNull_NoGroupRelay()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(new FakeOrganizerTracker(), jwtService: new AuthenticatingJwtService(OrganizerId));
        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await hub.UpdateFullState(PartyIdStr, null);

        AssertCallerError(hubCallerClients, "State cannot be null");
    }

    #endregion

    #region §4.3 Viewer / state edge cases

    [Test]
    public async Task JoinPartyAsViewer_PartyNotFound_SendsPartyNotFound_NoOnFullStateUpdated()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(
            new FakeOrganizerTracker(),
            streamingService: new ConfigurableStreamingService(getPartyState: _ => Task.FromResult<PartyStateDto?>(null)));
        AttachHubContext(hub, hubCallerClients, "conn-viewer");

        await hub.JoinPartyAsViewer(ShortCode);

        AssertCallerError(hubCallerClients, "Party not found");
        Assert.That(
            hubCallerClients.CallerProxy.Messages.Where(m => m.Method == "OnFullStateUpdated"),
            Is.Empty);
    }

    [Test]
    public async Task JoinPartyAsViewer_InvalidPartyIdInState_SendsInvalidPartyIdFormat()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var badState = new PartyStateDto(
            partyId: "not-a-guid",
            isSessionActive: false,
            partyDisplayStatus: PartyDisplayStatus.Scheduled);
        var hub = CreateDefaultHub(
            new FakeOrganizerTracker(),
            streamingService: new ConfigurableStreamingService(getPartyState: _ => Task.FromResult<PartyStateDto?>(badState)));
        AttachHubContext(hub, hubCallerClients, "conn-viewer");

        await hub.JoinPartyAsViewer(ShortCode);

        AssertCallerError(hubCallerClients, "Invalid party ID format");
    }

    [Test]
    public async Task JoinPartyAsViewer_ValidPartyNoPlayback_NoError_NoOnFullStateUpdated()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var stateWithoutPlayback = new PartyStateDto(
            partyId: PartyIdStr,
            isSessionActive: false,
            partyDisplayStatus: PartyDisplayStatus.Scheduled,
            playbackState: null);
        var hub = CreateDefaultHub(
            new FakeOrganizerTracker(),
            streamingService: new ConfigurableStreamingService(getPartyState: _ => Task.FromResult<PartyStateDto?>(stateWithoutPlayback)));
        AttachHubContext(hub, hubCallerClients, "conn-viewer");

        await hub.JoinPartyAsViewer(ShortCode);

        Assert.That(hubCallerClients.CallerProxy.Messages.Where(m => m.Method == "Error"), Is.Empty);
        Assert.That(
            hubCallerClients.CallerProxy.Messages.Where(m => m.Method == "OnFullStateUpdated"),
            Is.Empty);
    }

    [Test]
    public async Task JoinPartyAsViewerWithState_ValidParty_ReturnsPartyStateDtoMatchingSeededData()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var session = ActiveSession();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: false);
        await streamingRepository.SetSessionStateAsync(PartyId, session);

        var displayStatusService = new StubPartyDisplayStatusService(PartyDisplayStatus.Live);
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

        AttachHubContext(hub, new CapturingHubCallerClients(), "conn-viewer");

        var result = await hub.JoinPartyAsViewerWithState(ShortCode);

        Assert.That(result, Is.Not.Null);
        Assert.That(result!.PartyId, Is.EqualTo(PartyIdStr));
        Assert.That(result.PlaybackState, Is.Not.Null);
        Assert.That(result.PlaybackState!.Status, Is.EqualTo(session.Status));
        Assert.That(result.PartyDisplayStatus, Is.EqualTo(PartyDisplayStatus.Live));
    }

    [Test]
    public async Task JoinPartyAsViewerWithState_PartyNotFound_SendsPartyNotFound_ReturnsNull()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(
            new FakeOrganizerTracker(),
            streamingService: new ConfigurableStreamingService(getPartyState: _ => Task.FromResult<PartyStateDto?>(null)));
        AttachHubContext(hub, hubCallerClients, "conn-viewer");

        var result = await hub.JoinPartyAsViewerWithState(ShortCode);

        Assert.That(result, Is.Null);
        AssertCallerError(hubCallerClients, "Party not found");
    }

    [Test]
    public async Task JoinPartyAsViewerWithState_GenericStreamingException_SendsJoinPartyError()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(
            new FakeOrganizerTracker(),
            streamingService: new ThrowingStreamingService(
                getPartyState: _ => throw new InvalidOperationException("db fail")));
        AttachHubContext(hub, hubCallerClients, "conn-viewer");

        var result = await hub.JoinPartyAsViewerWithState(ShortCode);

        Assert.That(result, Is.Null);
        AssertCallerError(hubCallerClients, "An error occurred while joining the party");
    }

    [Test]
    public async Task RequestFullState_PartyNotFound_SendsPartyNotFound_ReturnsNull()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(
            new FakeOrganizerTracker(),
            streamingService: new ConfigurableStreamingService(getPartyState: _ => Task.FromResult<PartyStateDto?>(null)));
        AttachHubContext(hub, hubCallerClients, "conn-viewer");

        var result = await hub.RequestFullState(ShortCode);

        Assert.That(result, Is.Null);
        AssertCallerError(hubCallerClients, "Party not found");
    }

    [Test]
    public async Task RequestFullState_GenericStreamingException_SendsRequestStateError()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateDefaultHub(
            new FakeOrganizerTracker(),
            streamingService: new ThrowingStreamingService(
                getPartyState: _ => throw new InvalidOperationException("db fail")));
        AttachHubContext(hub, hubCallerClients, "conn-viewer");

        var result = await hub.RequestFullState(ShortCode);

        Assert.That(result, Is.Null);
        AssertCallerError(hubCallerClients, "An error occurred while requesting party state");
    }

    #endregion

    #region §4.5 OnDisconnectedAsync edge cases

    [Test]
    public async Task OnDisconnectedAsync_NonOrganizerConnection_SendsNoStatusOrDisplayMessages()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: false);

        var hubCallerClients = new CapturingHubCallerClients();
        var hubContext = new CapturingHubContext();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Scheduled),
            hubContext,
            new OrganizerConnectionTracker());

        AttachHubContext(hub, hubCallerClients, "conn-random-viewer");

        await hub.OnDisconnectedAsync(null);

        Assert.That(
            hubCallerClients.GroupProxy.Messages.Where(m => m.Method == "OnConnectionStatusChanged"),
            Is.Empty);
        Assert.That(
            hubContext.GroupProxy.Messages.Where(m => m.Method == "OnPartyDisplayStatusChanged"),
            Is.Empty);
    }

    #endregion

    #region §4.6 Exception paths on organizer methods

    private static IEnumerable<TestCaseData> PartyNotFoundStreamingMethodCases()
    {
        yield return new TestCaseData("StartSession").SetName("StartSession_PartyNotFound");
        yield return new TestCaseData("EndSession").SetName("EndSession_PartyNotFound");
        yield return new TestCaseData("ResetPlaybackState").SetName("ResetPlaybackState_PartyNotFound");
        yield return new TestCaseData("UpdateFullState").SetName("UpdateFullState_PartyNotFound");
        yield return new TestCaseData("UpdatePlaybackPosition").SetName("UpdatePlaybackPosition_PartyNotFound");
    }

    [TestCaseSource(nameof(PartyNotFoundStreamingMethodCases))]
    public async Task OrganizerMethod_PartyNotFoundFromStreaming_SendsExceptionMessage_NoGroupRelay(string methodName)
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new FakeOrganizerTracker();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: true);

        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Live),
            new CapturingHubContext(),
            tracker,
            streamingService: new ThrowingStreamingService(partyNotFoundMessage: "Party not found"),
            jwtService: new AuthenticatingJwtService(OrganizerId));
        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);

        await InvokeOrganizerMethodAsync(hub, methodName);

        AssertCallerError(hubCallerClients, "Party not found");
        AssertNoPrimaryGroupRelay(hubCallerClients, methodName);
    }

    [Test]
    public async Task UpdatePlaybackPosition_ArgumentException_SendsExceptionMessage_NoGroupRelay()
    {
        const string message = "Invalid track for party";
        var hubCallerClients = CreateAuthenticatedOrganizerHub(
            out var hub,
            new ThrowingStreamingService(updatePlaybackPosition: (_, _, _) => throw new ArgumentException(message)));

        await hub.UpdatePlaybackPosition(PartyIdStr, TrackId, Position);

        AssertCallerError(hubCallerClients, message);
        AssertNoPrimaryGroupRelay(hubCallerClients, "UpdatePlaybackPosition");
    }

    [Test]
    public async Task UpdatePlaybackPosition_InvalidOperationException_SendsExceptionMessage_NoGroupRelay()
    {
        const string message = "Session not active";
        var hubCallerClients = CreateAuthenticatedOrganizerHub(
            out var hub,
            new ThrowingStreamingService(updatePlaybackPosition: (_, _, _) => throw new InvalidOperationException(message)));

        await hub.UpdatePlaybackPosition(PartyIdStr, TrackId, Position);

        AssertCallerError(hubCallerClients, message);
        AssertNoPrimaryGroupRelay(hubCallerClients, "UpdatePlaybackPosition");
    }

    [Test]
    public async Task UpdatePlaybackPosition_GenericException_SendsGenericUpdatePositionError_NoGroupRelay()
    {
        var hubCallerClients = CreateAuthenticatedOrganizerHub(
            out var hub,
            new ThrowingStreamingService(updatePlaybackPosition: (_, _, _) => throw new Exception("boom")));

        await hub.UpdatePlaybackPosition(PartyIdStr, TrackId, Position);

        AssertCallerError(hubCallerClients, "An error occurred while updating playback position");
        AssertNoPrimaryGroupRelay(hubCallerClients, "UpdatePlaybackPosition");
    }

    [Test]
    public async Task UpdateFullState_GenericException_SendsGenericUpdateFullStateError_NoGroupRelay()
    {
        var hubCallerClients = CreateAuthenticatedOrganizerHub(
            out var hub,
            new ThrowingStreamingService(updateFullState: (_, _) => throw new Exception("boom")));

        await hub.UpdateFullState(PartyIdStr, ActiveSession().ToDto()!);

        AssertCallerError(hubCallerClients, "An error occurred while updating full state");
        AssertNoPrimaryGroupRelay(hubCallerClients, "UpdateFullState");
    }

    [Test]
    public async Task StartSession_GenericException_SendsGenericStartingSessionError_NoGroupRelay()
    {
        var hubCallerClients = CreateAuthenticatedOrganizerHub(
            out var hub,
            new ThrowingStreamingService(startSession: _ => throw new Exception("boom")));

        await hub.StartSession(PartyIdStr);

        AssertCallerError(hubCallerClients, "An error occurred while starting session");
        AssertNoPrimaryGroupRelay(hubCallerClients, "StartSession");
    }

    [Test]
    public async Task EndSession_GenericException_SendsGenericEndingSessionError_NoGroupRelay()
    {
        var hubCallerClients = CreateAuthenticatedOrganizerHub(
            out var hub,
            new ThrowingStreamingService(endSession: _ => throw new Exception("boom")));

        await hub.EndSession(PartyIdStr);

        AssertCallerError(hubCallerClients, "An error occurred while ending session");
        AssertNoPrimaryGroupRelay(hubCallerClients, "EndSession");
    }

    [Test]
    public async Task ResetPlaybackState_GenericException_SendsGenericResettingError_NoGroupRelay()
    {
        var hubCallerClients = CreateAuthenticatedOrganizerHub(
            out var hub,
            new ThrowingStreamingService(resetPlaybackState: _ => throw new Exception("boom")));

        await hub.ResetPlaybackState(PartyIdStr);

        AssertCallerError(hubCallerClients, "An error occurred while resetting playback state");
        AssertNoPrimaryGroupRelay(hubCallerClients, "ResetPlaybackState");
    }

    [Test]
    public async Task NotifyStateChanged_GenericException_SendsGenericNotifyStateError_NoGroupRelay()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var throwingClients = new ThrowingOnGroupSendHubCallerClients(hubCallerClients, "OnStateChanged");
        var hub = CreateDefaultHub(new FakeOrganizerTracker(), jwtService: new AuthenticatingJwtService(OrganizerId));
        AttachAuthenticatedHubContext(hub, throwingClients, ConnectionId);

        await hub.NotifyStateChanged(PartyIdStr);

        AssertCallerError(hubCallerClients, "An error occurred while notifying state change");
        AssertNoPrimaryGroupRelay(hubCallerClients, "NotifyStateChanged");
    }

    [Test]
    public async Task NotifyPlaylistChanged_GenericException_SendsGenericNotifyPlaylistError_NoGroupRelay()
    {
        var hubCallerClients = new CapturingHubCallerClients();
        var throwingClients = new ThrowingOnGroupSendHubCallerClients(hubCallerClients, "OnPlaylistChanged");
        var hub = CreateDefaultHub(new FakeOrganizerTracker(), jwtService: new AuthenticatingJwtService(OrganizerId));
        AttachAuthenticatedHubContext(hub, throwingClients, ConnectionId);

        await hub.NotifyPlaylistChanged(PartyIdStr);

        AssertCallerError(hubCallerClients, "An error occurred while notifying playlist change");
        AssertNoPrimaryGroupRelay(hubCallerClients, "NotifyPlaylistChanged");
    }

    [Test]
    public async Task JoinPartyAsOrganizer_GenericException_SendsGenericJoinOrganizerError_NoGroupRelay()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: false);

        var hubCallerClients = new CapturingHubCallerClients();
        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Scheduled),
            new CapturingHubContext(),
            new OrganizerConnectionTracker(),
            jwtService: new AuthenticatingJwtService(OrganizerId));
        AttachHubContext(hub, hubCallerClients, ConnectionId);
        SetHubProperty(hub, "Groups", new ThrowingGroupManager(new Exception("group add failed")));

        await hub.JoinPartyAsOrganizer(PartyIdStr, ValidToken);

        AssertCallerError(hubCallerClients, "An error occurred while joining as organizer");
        Assert.That(
            hubCallerClients.GroupProxy.Messages.Where(m => m.Method == "OnConnectionStatusChanged"),
            Is.Empty);
    }

    #endregion

    #region §4.8 Side effects

    [Test]
    public async Task JoinPartyAsOrganizer_Success_RegistersConnectionInTracker()
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new OrganizerConnectionTracker();
        await SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: false);

        var hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Scheduled),
            new CapturingHubContext(),
            tracker,
            jwtService: new AuthenticatingJwtService(OrganizerId));

        AttachHubContext(hub, new CapturingHubCallerClients(), ConnectionId);

        await hub.JoinPartyAsOrganizer(PartyIdStr, ValidToken);

        Assert.That(tracker.IsOrganizerConnected(PartyId), Is.True);
    }

    #endregion

    #region Helpers

    private static void AssertCallerError(CapturingHubCallerClients clients, string message)
    {
        var errors = clients.CallerProxy.Messages.Where(m => m.Method == "Error").ToList();
        Assert.That(errors, Has.Count.EqualTo(1), "Expected exactly one Error on caller");
        Assert.That(errors[0].Args, Is.EqualTo(new object?[] { message }));
    }

    private static void AssertNoPrimaryGroupRelay(CapturingHubCallerClients clients, string methodName)
    {
        var primaryMethod = methodName switch
        {
            "StartSession" => "OnSessionStarted",
            "EndSession" => "OnSessionEnded",
            "ResetPlaybackState" => "OnSessionEnded",
            "UpdateFullState" => "OnFullStateUpdated",
            "UpdatePlaybackPosition" => "OnPlaybackPositionUpdated",
            "NotifyStateChanged" => "OnStateChanged",
            "NotifyPlaylistChanged" => "OnPlaylistChanged",
            _ => throw new ArgumentOutOfRangeException(nameof(methodName), methodName, null),
        };

        Assert.That(
            clients.GroupProxy.Messages.Where(m => m.Method == primaryMethod),
            Is.Empty,
            $"Should not relay {primaryMethod} on failure");

        if (methodName == "ResetPlaybackState")
        {
            Assert.That(
                clients.GroupProxy.Messages.Where(m => m.Method == "PlaybackStateReset"),
                Is.Empty,
                "Should not relay PlaybackStateReset on failure");
        }
    }

    private static CapturingHubCallerClients CreateAuthenticatedOrganizerHub(
        out PartyHub hub,
        IStreamingService streamingService)
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        var tracker = new FakeOrganizerTracker();
        tracker.ConnectedPartyIds.Add(PartyId);
        SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: true).GetAwaiter().GetResult();

        var hubCallerClients = new CapturingHubCallerClients();
        hub = CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Live),
            new CapturingHubContext(),
            tracker,
            streamingService: streamingService,
            jwtService: new AuthenticatingJwtService(OrganizerId));
        AttachAuthenticatedHubContext(hub, hubCallerClients, ConnectionId);
        return hubCallerClients;
    }

    private static PartyHub CreateDefaultHub(
        IOrganizerConnectionTracker tracker,
        IStreamingService? streamingService = null,
        IJwtService? jwtService = null,
        IPartyAccessService? partyAccessService = null)
    {
        var partyRepository = new InMemoryPartyRepository();
        var streamingRepository = new InMemoryStreamingRepository();
        SeedReadyPartyAsync(partyRepository, streamingRepository, activeSession: false).GetAwaiter().GetResult();

        return CreateHub(
            partyRepository,
            streamingRepository,
            new StubPartyDisplayStatusService(PartyDisplayStatus.Scheduled),
            new CapturingHubContext(),
            tracker,
            streamingService: streamingService,
            jwtService: jwtService,
            partyAccessService: partyAccessService);
    }

    private static async Task InvokeOrganizerMethodAsync(PartyHub hub, string methodName, string? partyId = null)
    {
        var id = partyId ?? PartyIdStr;
        switch (methodName)
        {
            case "StartSession":
                await hub.StartSession(id);
                break;
            case "EndSession":
                await hub.EndSession(id);
                break;
            case "ResetPlaybackState":
                await hub.ResetPlaybackState(id);
                break;
            case "UpdateFullState":
                await hub.UpdateFullState(id, ActiveSession().ToDto()!);
                break;
            case "UpdatePlaybackPosition":
                await hub.UpdatePlaybackPosition(id, TrackId, Position);
                break;
            case "NotifyStateChanged":
                await hub.NotifyStateChanged(id);
                break;
            case "NotifyPlaylistChanged":
                await hub.NotifyPlaylistChanged(id);
                break;
            case "JoinPartyAsOrganizer":
                await hub.JoinPartyAsOrganizer(id, ValidToken);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(methodName), methodName, null);
        }
    }

    private static async Task SeedReadyPartyAsync(
        InMemoryPartyRepository partyRepository,
        IStreamingRepository streamingRepository,
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
        IPartyAccessService? partyAccessService = null)
    {
        return new PartyHub(
            streamingService ?? new StubStreamingService(),
            new PartyIdValidator(),
            jwtService ?? new StubJwtService(),
            partyAccessService ?? new StubPartyAccessService(),
            organizerTracker,
            partyRepository,
            streamingRepository,
            displayStatusService,
            hubContext,
            new StubScopeFactory(),
            Options.Create(new PartyDisplayStatusOptions { OrganizerOfflineGraceSeconds = 0 }),
            NullLogger<PartyHub>.Instance);
    }

    private static void AttachAuthenticatedHubContext(
        PartyHub hub,
        IHubCallerClients hubCallerClients,
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
        IHubCallerClients hubCallerClients,
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

        var assemblyName = new AssemblyName("CherryPlayServer.Tests.DynamicHttpContextFeature.Negative");
        var assemblyBuilder = AssemblyBuilder.DefineDynamicAssembly(assemblyName, AssemblyBuilderAccess.Run);
        var moduleBuilder = assemblyBuilder.DefineDynamicModule("MainModule");
        var typeBuilder = moduleBuilder.DefineType(
            "HttpContextFeatureProxyNegative",
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

    #endregion

    #region Test-only types

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

    private sealed class ThrowingOnGroupSendHubCallerClients(
        CapturingHubCallerClients inner,
        string throwOnMethod) : IHubCallerClients
    {
        public IClientProxy Caller => inner.CallerProxy;
        public IClientProxy Others => throw new NotSupportedException();
        public IClientProxy OthersInGroup(string groupName) => throw new NotSupportedException();
        public IClientProxy All => throw new NotSupportedException();
        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => throw new NotSupportedException();
        public IClientProxy Client(string connectionId) => throw new NotSupportedException();
        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => throw new NotSupportedException();
        public IClientProxy Group(string groupName) => new ThrowingGroupClientProxy(inner.GroupProxy, throwOnMethod);
        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) =>
            throw new NotSupportedException();
        public IClientProxy Groups(IReadOnlyList<string> groupNames) => throw new NotSupportedException();
        public IClientProxy User(string userId) => throw new NotSupportedException();
        public IClientProxy Users(IReadOnlyList<string> userIds) => throw new NotSupportedException();
    }

    private sealed class ThrowingGroupClientProxy(
        CapturingClientProxy inner,
        string throwOnMethod) : IClientProxy
    {
        public Task SendCoreAsync(string methodName, object?[] args, CancellationToken cancellationToken = default)
        {
            if (methodName == throwOnMethod)
            {
                throw new Exception($"Simulated failure sending {methodName}");
            }

            return inner.SendCoreAsync(methodName, args, cancellationToken);
        }
    }

    private sealed class NoOpGroupManager : IGroupManager
    {
        public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class ThrowingGroupManager(Exception exception) : IGroupManager
    {
        public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) =>
            throw exception;

        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class FailingJwtService : IJwtService
    {
        public Task<string> GenerateTokenAsync(Guid organizerId, string name, Guid sessionId, string role) =>
            Task.FromResult("token");

        public Task<JwtTokenValidationResult> ValidateTokenAsync(string token) =>
            Task.FromResult(new JwtTokenValidationResult(false, null, null, null, null, null));

        public Task<Guid?> GetOrganizerIdFromTokenAsync(string token) => Task.FromResult<Guid?>(null);
    }

    private sealed class AuthenticatingJwtService(Guid organizerId) : IJwtService
    {
        public Task<string> GenerateTokenAsync(Guid organizerId, string name, Guid sessionId, string role) =>
            Task.FromResult("token");

        public Task<JwtTokenValidationResult> ValidateTokenAsync(string token) =>
            Task.FromResult(new JwtTokenValidationResult(true, organizerId, Guid.NewGuid(), "Test Organizer", "organizer", null));

        public Task<Guid?> GetOrganizerIdFromTokenAsync(string token) => Task.FromResult<Guid?>(organizerId);
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

    private sealed class ThrowingPartyAccessService(Exception exception) : IPartyAccessService
    {
        public Task EnsurePartyOwnershipAsync(Guid partyId, Guid organizerId) => throw exception;
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

    private sealed class ConfigurableStreamingService(
        Func<string, Task<PartyStateDto?>>? getPartyState = null) : IStreamingService
    {
        public Task<PartyStateDto?> GetPartyStateAsync(string shortCode) =>
            getPartyState != null ? getPartyState(shortCode) : Task.FromResult<PartyStateDto?>(null);

        public Task StartSessionAsync(Guid partyId) => Task.CompletedTask;
        public Task EndSessionAsync(Guid partyId) => Task.CompletedTask;
        public Task ResetPlaybackStateAsync(Guid partyId) => Task.CompletedTask;
        public Task UpdatePlaybackPositionAsync(Guid partyId, string trackId, double position) => Task.CompletedTask;
        public Task UpdateFullStateAsync(Guid partyId, PlaybackStateDto stateDto) => Task.CompletedTask;
    }

    private sealed class ThrowingStreamingService : IStreamingService
    {
        private readonly Func<string, Task<PartyStateDto?>>? _getPartyState;
        private readonly Func<Guid, Task>? _startSession;
        private readonly Func<Guid, Task>? _endSession;
        private readonly Func<Guid, Task>? _resetPlaybackState;
        private readonly Func<Guid, string, double, Task>? _updatePlaybackPosition;
        private readonly Func<Guid, PlaybackStateDto, Task>? _updateFullState;
        private readonly string? _partyNotFoundMessage;

        public ThrowingStreamingService(
            Func<string, Task<PartyStateDto?>>? getPartyState = null,
            Func<Guid, Task>? startSession = null,
            Func<Guid, Task>? endSession = null,
            Func<Guid, Task>? resetPlaybackState = null,
            Func<Guid, string, double, Task>? updatePlaybackPosition = null,
            Func<Guid, PlaybackStateDto, Task>? updateFullState = null,
            string? partyNotFoundMessage = null)
        {
            _getPartyState = getPartyState;
            _startSession = startSession;
            _endSession = endSession;
            _resetPlaybackState = resetPlaybackState;
            _updatePlaybackPosition = updatePlaybackPosition;
            _updateFullState = updateFullState;
            _partyNotFoundMessage = partyNotFoundMessage;
        }

        public Task<PartyStateDto?> GetPartyStateAsync(string shortCode) =>
            _getPartyState != null
                ? _getPartyState(shortCode)
                : Task.FromResult<PartyStateDto?>(null);

        public Task StartSessionAsync(Guid partyId) =>
            _startSession != null
                ? _startSession(partyId)
                : throw CreatePartyNotFound(partyId);

        public Task EndSessionAsync(Guid partyId) =>
            _endSession != null
                ? _endSession(partyId)
                : throw CreatePartyNotFound(partyId);

        public Task ResetPlaybackStateAsync(Guid partyId) =>
            _resetPlaybackState != null
                ? _resetPlaybackState(partyId)
                : throw CreatePartyNotFound(partyId);

        public Task UpdatePlaybackPositionAsync(Guid partyId, string trackId, double position) =>
            _updatePlaybackPosition != null
                ? _updatePlaybackPosition(partyId, trackId, position)
                : throw CreatePartyNotFound(partyId);

        public Task UpdateFullStateAsync(Guid partyId, PlaybackStateDto stateDto) =>
            _updateFullState != null
                ? _updateFullState(partyId, stateDto)
                : throw CreatePartyNotFound(partyId);

        private PartyNotFoundException CreatePartyNotFound(Guid partyId) =>
            _partyNotFoundMessage != null
                ? new PartyNotFoundWithMessageException(partyId, _partyNotFoundMessage)
                : new PartyNotFoundException(partyId);
    }

    private sealed class PartyNotFoundWithMessageException(Guid partyId, string message) : PartyNotFoundException(partyId)
    {
        public override string Message => message;
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

    #endregion
}
