using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR.Client;

namespace CherryPlayServer.Tests;

[TestFixture]
[Category("ContainerIntegration")]
[NonParallelizable]
public sealed class ContainerSignalRSessionParityTests
{
    private ContainerIntegrationTestContext _context = null!;
    private Guid _partyId;
    private HubConnection _viewer = null!;
    private ContainerSignalRSessionEventProbe _viewerEvents = null!;

    [SetUp]
    public async Task SetUp()
    {
        _context = await ContainerIntegrationTestContext.CreateAsync();
        _partyId = await _context.CreatePartyAsync();
        await _context.AddPlaylistAsync(_partyId, "[{\"id\":\"track-a\",\"type\":\"track\",\"name\":\"Track A\",\"displayOrder\":0,\"level\":0,\"duration\":90}]");
        _viewer = await ConnectAsync();
        _viewerEvents = new ContainerSignalRSessionEventProbe(_viewer);
        await InvokeAsync(_viewer, "JoinPartyAsViewer", _context.ShortCodeFor(_partyId));
    }

    [TearDown]
    public async Task TearDown()
    {
        _viewerEvents?.Dispose();
        if (_viewer is not null)
        {
            await _viewer.DisposeAsync();
        }
        if (_context is not null)
        {
            await _context.DisposeAsync();
        }
    }

    [Test]
    public async Task SR11_LogoutRejectsWriteOnExistingConnection()
    {
        await using var organizer = await ConnectAsync(_context.Token);
        using var errors = new ContainerSignalRSessionEventProbe(organizer);
        await JoinAndWriteAsync(organizer, errors, _context.Token);
        var before = await ReadPersistedSnapshotAsync();

        await LogoutAsync();

        await AssertRejectedAsync(organizer, errors, "UpdatePlaybackPosition", before);
    }

    [Test]
    public async Task SR12_PasswordResetRejectsWritesOnBothExistingConnections()
    {
        var accountId = await _context.AddEmailAccountAsync("container-old-password-123");
        var resetToken = await _context.CreatePasswordResetTokenAsync(accountId);
        var secondToken = await _context.CreateAdditionalSessionTokenAsync();
        await using var first = await ConnectAsync(_context.Token);
        await using var second = await ConnectAsync(secondToken);
        using var firstErrors = new ContainerSignalRSessionEventProbe(first);
        using var secondErrors = new ContainerSignalRSessionEventProbe(second);
        await JoinAndWriteAsync(first, firstErrors, _context.Token);
        await JoinAndWriteAsync(second, secondErrors, secondToken);
        var before = await ReadPersistedSnapshotAsync();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/auth/reset-password")
        {
            Content = ContainerIntegrationTestContext.Json(JsonSerializer.Serialize(new { token = resetToken, newPassword = "container-reset-password-123" }))
        };

        await AssertNoContentAsync(request);

        await AssertRejectedAsync(first, firstErrors, "UpdatePlaybackPosition", before);
        await AssertRejectedAsync(second, secondErrors, "UpdatePlaybackPosition", before);
    }

    [Test]
    public async Task SR13_PasswordChangeRejectsWritesOnBothExistingConnections()
    {
        await _context.AddEmailAccountAsync("container-old-password-123");
        var secondToken = await _context.CreateAdditionalSessionTokenAsync();
        await using var first = await ConnectAsync(_context.Token);
        await using var second = await ConnectAsync(secondToken);
        using var firstErrors = new ContainerSignalRSessionEventProbe(first);
        using var secondErrors = new ContainerSignalRSessionEventProbe(second);
        await JoinAndWriteAsync(first, firstErrors, _context.Token);
        await JoinAndWriteAsync(second, secondErrors, secondToken);
        var before = await ReadPersistedSnapshotAsync();
        using var request = _context.Authenticated(HttpMethod.Post, "/auth/change-password",
            ContainerIntegrationTestContext.Json("{\"oldPassword\":\"container-old-password-123\",\"newPassword\":\"container-new-password-123\"}"));

        await AssertNoContentAsync(request);

        await AssertRejectedAsync(first, firstErrors, "UpdatePlaybackPosition", before);
        await AssertRejectedAsync(second, secondErrors, "UpdatePlaybackPosition", before);
    }

    [Test]
    public async Task SR14_ParameterTokenJoinRejectsRevokedSessionWithoutTransportToken()
    {
        await using var organizer = await ConnectAsync();
        using var errors = new ContainerSignalRSessionEventProbe(organizer);
        await InvokeAsync(organizer, "JoinPartyAsOrganizer", _partyId.ToString(), _context.Token);
        var joined = await _viewerEvents.WaitForEventAsync("OnConnectionStatusChanged");
        Assert.That(joined, Is.EqualTo(new object[] { _partyId.ToString(), true }));
        await _viewerEvents.WaitForEventAsync("OnPartyDisplayStatusChanged");
        Assert.That(errors.Errors, Is.Empty);
        var before = await ReadPersistedSnapshotAsync();
        await _context.DeleteSessionAsync();
        _viewerEvents.BeginObservation();
        errors.BeginObservation();
        var originalConnectionId = organizer.ConnectionId;

        await InvokeAsync(organizer, "JoinPartyAsOrganizer", _partyId.ToString(), _context.Token);

        Assert.That(await errors.WaitForErrorAsync(), Is.EqualTo("Authentication token is required"));
        await AssertUnchangedAndNoRelayAsync(before);
        Assert.That(organizer.State, Is.EqualTo(HubConnectionState.Connected));
        Assert.That(organizer.ConnectionId, Is.EqualTo(originalConnectionId));
    }

    [TestCase("UpdatePlaybackPosition")]
    [TestCase("UpdateFullState")]
    [TestCase("NotifyStateChanged")]
    [TestCase("NotifyPlaylistChanged")]
    [TestCase("StartSession")]
    [TestCase("EndSession")]
    [TestCase("ResetPlaybackState")]
    public async Task SR15_DeletedSessionRejectsEveryOrganizerWrite(string method)
    {
        await using var organizer = await ConnectAsync(_context.Token);
        using var errors = new ContainerSignalRSessionEventProbe(organizer);
        await JoinAndWriteAsync(organizer, errors, _context.Token);
        var before = await ReadPersistedSnapshotAsync();

        await _context.DeleteSessionAsync();

        await AssertRejectedAsync(organizer, errors, method, before);
    }

    [Test]
    public async Task SR16_LogoutPreservesOtherSessionWriteAccess()
    {
        var secondToken = await _context.CreateAdditionalSessionTokenAsync();
        await using var first = await ConnectAsync(_context.Token);
        await using var second = await ConnectAsync(secondToken);
        using var firstErrors = new ContainerSignalRSessionEventProbe(first);
        using var secondErrors = new ContainerSignalRSessionEventProbe(second);
        await JoinAndWriteAsync(first, firstErrors, _context.Token);
        await JoinAndWriteAsync(second, secondErrors, secondToken);
        var before = await ReadPersistedSnapshotAsync();

        await LogoutAsync();

        await AssertRejectedAsync(first, firstErrors, "UpdatePlaybackPosition", before);
        _viewerEvents.BeginObservation();
        secondErrors.BeginObservation();
        await InvokeAsync(second, "UpdatePlaybackPosition", _partyId.ToString(), "track-a", 43d);
        var updated = await _viewerEvents.WaitForEventAsync("OnPlaybackPositionUpdated");
        Assert.That(updated, Is.EqualTo(new object[] { _partyId.ToString(), "track-a", 43d }));
        Assert.That(secondErrors.Errors, Is.Empty);
        Assert.That(second.State, Is.EqualTo(HubConnectionState.Connected));
        using var state = await ReadPublicStateAsync();
        Assert.That(state.RootElement.GetProperty("playbackState").GetProperty("position").GetDouble(), Is.EqualTo(43));
    }

    private async Task<HubConnection> ConnectAsync(string? transportToken = null)
    {
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(_context.Client.BaseAddress!, "partyHub"), options =>
            {
                if (transportToken is not null)
                {
                    options.AccessTokenProvider = () => Task.FromResult<string?>(transportToken);
                }
            })
            .Build();
        try
        {
            await connection.StartAsync().WaitAsync(TimeSpan.FromSeconds(10));
            return connection;
        }
        catch
        {
            await connection.DisposeAsync();
            throw;
        }
    }

    private async Task JoinAndWriteAsync(HubConnection organizer, ContainerSignalRSessionEventProbe errors, string token)
    {
        await InvokeAsync(organizer, "JoinPartyAsOrganizer", _partyId.ToString(), token);
        await _viewerEvents.WaitForEventAsync("OnPartyDisplayStatusChanged");
        await InvokeAsync(organizer, "StartSession", _partyId.ToString());
        await _viewerEvents.WaitForEventAsync("OnSessionStarted");
        await _viewerEvents.WaitForEventAsync("OnPartyDisplayStatusChanged");
        await InvokeAsync(organizer, "UpdatePlaybackPosition", _partyId.ToString(), "track-a", 20d);
        var updated = await _viewerEvents.WaitForEventAsync("OnPlaybackPositionUpdated");
        Assert.That(updated, Is.EqualTo(new object[] { _partyId.ToString(), "track-a", 20d }));
        Assert.That(errors.Errors, Is.Empty);
        using var state = await ReadPublicStateAsync();
        Assert.That(state.RootElement.GetProperty("playbackState").GetProperty("position").GetDouble(), Is.EqualTo(20));
        _viewerEvents.BeginObservation();
    }

    private async Task AssertRejectedAsync(HubConnection organizer, ContainerSignalRSessionEventProbe errors, string method, string before)
    {
        _viewerEvents.BeginObservation();
        errors.BeginObservation();
        var originalConnectionId = organizer.ConnectionId;
        var partyId = _partyId.ToString();
        var operation = method switch
        {
            "UpdatePlaybackPosition" => InvokeAsync(organizer, method, partyId, "track-a", 42d),
            "UpdateFullState" => InvokeAsync(organizer, method, partyId, new
            {
                currentTrackId = "track-a", status = "playing", position = 42d, duration = 90d, volume = 0.8d,
                mode = "session", playedTrackIds = Array.Empty<string>(), disabledTrackIds = Array.Empty<string>(), disabledGroupIds = Array.Empty<string>()
            }),
            _ => InvokeAsync(organizer, method, partyId)
        };
        await operation;

        Assert.That(await errors.WaitForErrorAsync(), Is.EqualTo("Authentication required"));
        await AssertUnchangedAndNoRelayAsync(before);
        Assert.That(organizer.State, Is.EqualTo(HubConnectionState.Connected));
        Assert.That(organizer.ConnectionId, Is.EqualTo(originalConnectionId));
    }

    private async Task AssertUnchangedAndNoRelayAsync(string before)
    {
        await Task.Delay(TimeSpan.FromMilliseconds(500));
        Assert.That(_viewerEvents.SuccessEvents, Is.Empty);
        Assert.That(_viewerEvents.Errors, Is.Empty);
        Assert.That(await ReadPersistedSnapshotAsync(), Is.EqualTo(before));
    }

    private async Task<string> ReadPersistedSnapshotAsync()
    {
        using var state = await ReadPublicStateAsync();
        return JsonSerializer.Serialize(new
        {
            active = state.RootElement.GetProperty("isSessionActive").GetBoolean(),
            playback = state.RootElement.GetProperty("playbackState"),
            playlist = state.RootElement.GetProperty("playlist")
        });
    }

    private async Task<JsonDocument> ReadPublicStateAsync()
    {
        using var response = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(_partyId)}/state");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    }

    private async Task LogoutAsync()
    {
        using var request = _context.Authenticated(HttpMethod.Post, "/auth/logout");
        await AssertNoContentAsync(request);
    }

    private async Task AssertNoContentAsync(HttpRequestMessage request)
    {
        using var response = await _context.Client.SendAsync(request);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), await response.Content.ReadAsStringAsync());
    }

    private static Task InvokeAsync(HubConnection connection, string method, params object?[] arguments) =>
        connection.InvokeCoreAsync(method, arguments).WaitAsync(TimeSpan.FromSeconds(10));
}
