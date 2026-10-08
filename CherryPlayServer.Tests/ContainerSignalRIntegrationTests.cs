using System.Net;
using System.Text.Json;
using System.Threading.Channels;
using Microsoft.AspNetCore.SignalR.Client;

namespace CherryPlayServer.Tests;

[TestFixture]
[Category("ContainerIntegration")]
[NonParallelizable]
public sealed class ContainerSignalRIntegrationTests
{
    private ContainerIntegrationTestContext _context = null!;
    private Guid _partyId;

    [SetUp]
    public async Task SetUp()
    {
        _context = await ContainerIntegrationTestContext.CreateAsync();
        _partyId = await _context.CreatePartyAsync();
        await _context.AddPlaylistAsync(_partyId, "[{\"id\":\"track-a\",\"type\":\"track\",\"name\":\"Track A\",\"displayOrder\":0,\"level\":0,\"duration\":90}]");
    }

    [TearDown]
    public async Task TearDown()
    {
        if (_context is not null)
        {
            await _context.DisposeAsync();
        }
    }

    [Test]
    public async Task SR01_AnonymousViewerCannotInvokeOrganizerWrites()
    {
        await using var viewer = await ConnectViewerAsync();
        await viewer.InvokeAsync("JoinPartyAsViewer", _context.ShortCodeFor(_partyId));
        var errors = new List<string>();
        viewer.On<string>("Error", errors.Add);
        var successEvents = new System.Collections.Concurrent.ConcurrentQueue<string>();
        viewer.On<string>("OnSessionStarted", _ => successEvents.Enqueue("OnSessionStarted"));
        viewer.On<string>("OnSessionEnded", _ => successEvents.Enqueue("OnSessionEnded"));
        viewer.On<string>("OnStateChanged", _ => successEvents.Enqueue("OnStateChanged"));
        viewer.On<string>("OnPlaylistChanged", _ => successEvents.Enqueue("OnPlaylistChanged"));
        viewer.On<string, string, double>("OnPlaybackPositionUpdated", (_, _, _) => successEvents.Enqueue("OnPlaybackPositionUpdated"));
        viewer.On<string, JsonElement>("OnFullStateUpdated", (_, _) => successEvents.Enqueue("OnFullStateUpdated"));
        viewer.On<string>("PlaybackStateReset", _ => successEvents.Enqueue("PlaybackStateReset"));
        viewer.On<string, JsonElement>("OnPartyDisplayStatusChanged", (_, _) => successEvents.Enqueue("OnPartyDisplayStatusChanged"));

        await viewer.InvokeAsync("StartSession", _partyId.ToString());
        await viewer.InvokeAsync("UpdatePlaybackPosition", _partyId.ToString(), "track-a", 20d);
        await viewer.InvokeAsync("UpdateFullState", _partyId.ToString(), new { currentTrackId = "track-a", status = "playing", position = 20d, duration = 90d, volume = 0.8d, mode = "preparation", playedTrackIds = Array.Empty<string>(), disabledTrackIds = Array.Empty<string>(), disabledGroupIds = Array.Empty<string>() });
        await viewer.InvokeAsync("NotifyStateChanged", _partyId.ToString());
        await viewer.InvokeAsync("NotifyPlaylistChanged", _partyId.ToString());
        await viewer.InvokeAsync("EndSession", _partyId.ToString());
        await viewer.InvokeAsync("ResetPlaybackState", _partyId.ToString());
        await viewer.InvokeAsync("JoinPartyAsOrganizer", _partyId.ToString(), "");

        Assert.That(errors, Has.Count.EqualTo(8));
        await Task.Delay(TimeSpan.FromMilliseconds(500));
        Assert.That(successEvents, Is.Empty);
        using var state = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(_partyId)}/state");
        using var document = JsonDocument.Parse(await state.Content.ReadAsStringAsync());
        Assert.That(document.RootElement.GetProperty("isSessionActive").GetBoolean(), Is.False);
    }

    [Test]
    public async Task SR02_OrganizerCannotJoinAnotherOrganizersParty()
    {
        var otherOwner = await _context.CreateAdditionalOrganizerAsync();
        var otherParty = await _context.CreatePartyAsync(organizerId: otherOwner);
        await using var connection = await ConnectOrganizerAsync();
        var error = ReceiveError(connection);

        await connection.InvokeAsync("JoinPartyAsOrganizer", otherParty.ToString(), _context.Token);
        var writeError = ReceiveError(connection);
        await connection.InvokeAsync("StartSession", otherParty.ToString());

        Assert.That(await error, Does.Contain("permission"));
        Assert.That(await writeError, Does.Contain("permission"));
        using var state = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(otherParty)}/state");
        using var document = JsonDocument.Parse(await state.Content.ReadAsStringAsync());
        Assert.That(document.RootElement.GetProperty("isSessionActive").GetBoolean(), Is.False);
    }

    [Test]
    public async Task SR03_RevokedSessionDoesNotAuthorizeHubWrites()
    {
        await _context.AddSessionStateAsync(_partyId, position: 10);
        await using var organizer = await ConnectOrganizerAsync();
        var errors = new List<string>();
        organizer.On<string>("Error", errors.Add);
        await _context.DeleteSessionAsync();
        var errorReceived = ReceiveError(organizer);

        await organizer.InvokeAsync("UpdatePlaybackPosition", _partyId.ToString(), "track-a", 42d);

        Assert.That(await errorReceived, Does.Contain("Authentication required"));
        using var response = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(_partyId)}/state");
        using var state = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.That(state.RootElement.GetProperty("playbackState").GetProperty("position").GetDouble(), Is.EqualTo(10));
    }

    [Test]
    public async Task SR04_ViewerReceivesEventsOnlyForJoinedParty()
    {
        var secondParty = await _context.CreatePartyAsync();
        await using var firstViewer = await ConnectViewerAsync();
        await using var secondViewer = await ConnectViewerAsync();
        var firstEvent = ReceiveEvent(firstViewer, "OnStateChanged");
        var secondEvent = ReceiveEventSource(secondViewer, "OnStateChanged");
        await firstViewer.InvokeAsync("JoinPartyAsViewer", _context.ShortCodeFor(_partyId));
        await secondViewer.InvokeAsync("JoinPartyAsViewer", _context.ShortCodeFor(secondParty));
        await using var organizer = await ConnectOrganizerAsync();
        await organizer.InvokeAsync("JoinPartyAsOrganizer", _partyId.ToString(), _context.Token);
        await organizer.InvokeAsync("NotifyStateChanged", _partyId.ToString());

        Assert.That(await firstEvent, Is.EqualTo(_partyId.ToString()));
        await Task.Delay(TimeSpan.FromMilliseconds(500));
        Assert.That(secondEvent.Task.IsCompleted, Is.False);
    }

    [Test]
    public async Task SR05_ViewerJoinReturnsCurrentPersistedSnapshot()
    {
        await _context.AddSessionStateAsync(_partyId, position: 23.5);
        await using var viewer = await ConnectViewerAsync();

        var state = await viewer.InvokeAsync<JsonElement>("JoinPartyAsViewerWithState", _context.ShortCodeFor(_partyId));

        Assert.That(state.GetProperty("partyId").GetString(), Is.EqualTo(_partyId.ToString()));
        Assert.That(state.GetProperty("playbackState").GetProperty("position").GetDouble(), Is.EqualTo(23.5));
        Assert.That(state.GetProperty("playlist").GetProperty("items")[0].GetProperty("id").GetString(), Is.EqualTo("track-a"));
    }

    [Test]
    public async Task SR06_NewViewerConnectionCanRequestCurrentSnapshotAfterReconnect()
    {
        await _context.AddSessionStateAsync(_partyId, position: 31);
        await using (var original = await ConnectViewerAsync())
        {
            await original.InvokeAsync("JoinPartyAsViewer", _context.ShortCodeFor(_partyId));
        }

        await using var reconnected = await ConnectViewerAsync();
        var snapshot = await reconnected.InvokeAsync<JsonElement>("JoinPartyAsViewerWithState", _context.ShortCodeFor(_partyId));

        Assert.That(snapshot.GetProperty("playbackState").GetProperty("position").GetDouble(), Is.EqualTo(31));
    }

    [Test]
    public async Task SR07_StartAndEndSessionPersistFreezeAndNotifyViewers()
    {
        await _context.AddSessionStateAsync(_partyId, position: 27);
        await using var viewer = await ConnectViewerAsync();
        await viewer.InvokeAsync("JoinPartyAsViewer", _context.ShortCodeFor(_partyId));
        var started = ReceiveEvent(viewer, "OnSessionStarted");
        var ended = ReceiveEvent(viewer, "OnSessionEnded");
        await using var organizer = await ConnectOrganizerAsync();
        await organizer.InvokeAsync("JoinPartyAsOrganizer", _partyId.ToString(), _context.Token);
        await organizer.InvokeAsync("StartSession", _partyId.ToString());
        Assert.That(await started, Is.EqualTo(_partyId.ToString()));
        await organizer.InvokeAsync("EndSession", _partyId.ToString());
        Assert.That(await ended, Is.EqualTo(_partyId.ToString()));
        using var response = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(_partyId)}/state");
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(result.RootElement.GetProperty("isSessionActive").GetBoolean(), Is.False);
        Assert.That(result.RootElement.GetProperty("playbackState").GetProperty("position").GetDouble(), Is.EqualTo(27));
    }

    [Test]
    public async Task SR08_HttpPlaylistPublishNotifiesConnectedViewer()
    {
        await using var viewer = await ConnectViewerAsync();
        await viewer.InvokeAsync("JoinPartyAsViewer", _context.ShortCodeFor(_partyId));
        var changed = ReceiveEvent(viewer, "OnPlaylistChanged");
        using var request = _context.Authenticated(HttpMethod.Put, $"/api/parties/{_partyId}/playlist", ContainerIntegrationTestContext.Json("{\"items\":[{\"id\":\"track-b\",\"type\":\"track\",\"name\":\"Track B\",\"displayOrder\":0,\"level\":0,\"duration\":60}],\"totalDuration\":60,\"totalTracks\":1}"));

        using var response = await _context.Client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(await changed, Is.EqualTo(_partyId.ToString()));
    }

    [Test]
    public async Task SR09_OrganizerDisconnectReportsOfflineAndReconnectReportsOnline()
    {
        await _context.AddSessionStateAsync(_partyId, mode: "session");
        await using var viewer = await ConnectViewerAsync();
        await viewer.InvokeAsync("JoinPartyAsViewer", _context.ShortCodeFor(_partyId));
        var connectionChanges = Channel.CreateUnbounded<bool>();
        var displayChanges = Channel.CreateUnbounded<(string PartyId, JsonElement Status)>();
        viewer.On<string, bool>("OnConnectionStatusChanged", (_, online) =>
        {
            connectionChanges.Writer.TryWrite(online);
        });
        viewer.On<string, JsonElement>("OnPartyDisplayStatusChanged", (partyId, status) => displayChanges.Writer.TryWrite((partyId, status)));
        await using (var organizer = await ConnectOrganizerAsync())
        {
            await organizer.InvokeAsync("JoinPartyAsOrganizer", _partyId.ToString(), _context.Token);
            Assert.That(await connectionChanges.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(10)), Is.True);
            var onlineDisplay = await displayChanges.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(10));
            Assert.That(onlineDisplay.PartyId, Is.EqualTo(_partyId.ToString()));
            Assert.That(onlineDisplay.Status.GetString(), Is.EqualTo("live"));
        }

        Assert.That(await connectionChanges.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(10)), Is.False);
        var disconnectedDisplay = await displayChanges.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(10));
        Assert.That(disconnectedDisplay.PartyId, Is.EqualTo(_partyId.ToString()));
        Assert.That(disconnectedDisplay.Status.GetString(), Is.EqualTo("live"));
        var graceExpiredDisplay = await displayChanges.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(5));
        Assert.That(graceExpiredDisplay.PartyId, Is.EqualTo(_partyId.ToString()));
        Assert.That(graceExpiredDisplay.Status.GetString(), Is.EqualTo("organizer_offline"));
        using var currentState = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(_partyId)}/state");
        using var currentStateJson = JsonDocument.Parse(await currentState.Content.ReadAsStringAsync());
        Assert.That(currentStateJson.RootElement.GetProperty("isSessionActive").GetBoolean(), Is.True);
        await using var reconnected = await ConnectOrganizerAsync();
        await reconnected.InvokeAsync("JoinPartyAsOrganizer", _partyId.ToString(), _context.Token);

        Assert.That(await connectionChanges.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(10)), Is.True);
        var reconnectedDisplay = await displayChanges.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(10));
        Assert.That(reconnectedDisplay.PartyId, Is.EqualTo(_partyId.ToString()));
        Assert.That(reconnectedDisplay.Status.GetString(), Is.EqualTo("live"));
    }

    [Test]
    public async Task SR10_FailedWriteDoesNotPublishSuccessEvent()
    {
        await _context.AddSessionStateAsync(_partyId, position: 12.5);
        await _context.InstallSessionWriteFailureAsync(_partyId);
        await using var viewer = await ConnectViewerAsync();
        await viewer.InvokeAsync("JoinPartyAsViewer", _context.ShortCodeFor(_partyId));
        var eventReceived = ReceiveEvent(viewer, "OnFullStateUpdated");
        await using var organizer = await ConnectOrganizerAsync();
        await organizer.InvokeAsync("JoinPartyAsOrganizer", _partyId.ToString(), _context.Token);
        var errorReceived = ReceiveError(organizer);

        await organizer.InvokeAsync("UpdateFullState", _partyId.ToString(), new { currentTrackId = "track-a", status = "playing", position = 40d, duration = 90d, volume = 0.8d, mode = "preparation", playedTrackIds = new[] { "track-a" }, disabledTrackIds = Array.Empty<string>(), disabledGroupIds = Array.Empty<string>() });

        Assert.That(await errorReceived, Does.Contain("updating full state"));
        await Task.Delay(TimeSpan.FromMilliseconds(500));
        Assert.That(eventReceived.IsCompleted, Is.False);
        using var response = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(_partyId)}/state");
        using var state = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.That(state.RootElement.GetProperty("playbackState").GetProperty("position").GetDouble(), Is.EqualTo(12.5));
    }

    private async Task<HubConnection> ConnectViewerAsync()
    {
        var connection = new HubConnectionBuilder().WithUrl(new Uri(_context.Client.BaseAddress!, "partyHub")).Build();
        await connection.StartAsync();
        return connection;
    }

    private async Task<HubConnection> ConnectOrganizerAsync()
    {
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(_context.Client.BaseAddress!, "partyHub"), options =>
                options.AccessTokenProvider = () => Task.FromResult<string?>(_context.Token))
            .Build();
        await connection.StartAsync();
        return connection;
    }

    private static Task<string> ReceiveError(HubConnection connection)
    {
        var source = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<string>("Error", message => source.TrySetResult(message));
        return source.Task.WaitAsync(TimeSpan.FromSeconds(10));
    }

    private static Task<string> ReceiveEvent(HubConnection connection, string eventName)
    {
        var source = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<string>(eventName, value => source.TrySetResult(value));
        return source.Task.WaitAsync(TimeSpan.FromSeconds(10));
    }

    private static TaskCompletionSource<string> ReceiveEventSource(HubConnection connection, string eventName)
    {
        var source = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        connection.On<string>(eventName, value => source.TrySetResult(value));
        return source;
    }
}
