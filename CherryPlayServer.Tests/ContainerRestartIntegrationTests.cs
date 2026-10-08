using System.Text.Json;
using Microsoft.AspNetCore.SignalR.Client;

namespace CherryPlayServer.Tests;

[TestFixture]
[NonParallelizable]
public sealed class ContainerRestartIntegrationTests
{
    private static readonly Guid OrganizerId = Guid.Parse("a0c35e63-d937-47b9-b34a-248f94f61331");
    private static readonly Guid SessionId = Guid.Parse("97c175fe-1387-4ef6-a332-e7b2127dc42a");
    private static readonly Guid DefaultPartyId = Guid.Parse("d90d949e-4eca-44b0-9187-d1d7082cf001");
    private static readonly Guid DefaultFreezePartyId = Guid.Parse("d90d949e-4eca-44b0-9187-d1d7082cf002");
    private static readonly string RestartPartyIdVariable = "CHERRYPLAY_RESTART_PARTY_ID";
    private static readonly string RestartShortCodeVariable = "CHERRYPLAY_RESTART_SHORT_CODE";
    private static readonly string FreezePartyIdVariable = "CHERRYPLAY_RESTART_FREEZE_PARTY_ID";
    private static readonly string FreezeShortCodeVariable = "CHERRYPLAY_RESTART_FREEZE_SHORT_CODE";

    [Test]
    [Category("ContainerRestartPrepare")]
    public async Task SYS01_PreparePartyPlaylistAndActivePlaybackStateForServerRestart()
    {
        var partyId = ReadGuid(RestartPartyIdVariable, DefaultPartyId);
        var shortCode = ReadString(RestartShortCodeVariable, "itrestart01");
        await using var context = await ContainerIntegrationTestContext.CreateRestartContextAsync(OrganizerId, SessionId);
        await context.CreateRestartPartyAsync(partyId, shortCode);
        await context.AddPlaylistAsync(partyId, "[{\"id\":\"restart-track\",\"type\":\"track\",\"name\":\"Restart track\",\"displayOrder\":0,\"level\":0,\"duration\":120}]");
        await using var hub = await ConnectOrganizerAsync(context);
        await hub.InvokeAsync("JoinPartyAsOrganizer", partyId.ToString(), context.Token);
        await hub.InvokeAsync("StartSession", partyId.ToString());
        await hub.InvokeAsync("UpdateFullState", partyId.ToString(), new { currentTrackId = "restart-track", status = "playing", position = 18.75, duration = 120d, volume = 0.7d, mode = "preparation", playedTrackIds = new[] { "restart-track" }, disabledTrackIds = new[] { "disabled-track" }, disabledGroupIds = new[] { "disabled-group" } });
        using var response = await context.Client.GetAsync($"/api/parties/public/{shortCode}/state");
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(result.RootElement.GetProperty("isSessionActive").GetBoolean(), Is.True);
        Assert.That(result.RootElement.GetProperty("playbackState").GetProperty("position").GetDouble(), Is.EqualTo(18.75));
    }

    [Test]
    [Category("ContainerRestartVerify")]
    public async Task SYS01_VerifyPartyPlaylistAndPlaybackStateAfterServerRestart()
    {
        var partyId = ReadGuid(RestartPartyIdVariable, DefaultPartyId);
        var shortCode = ReadString(RestartShortCodeVariable, "itrestart01");
        await using var context = await ContainerIntegrationTestContext.CreateRestartContextAsync(OrganizerId, SessionId);
        using var response = await context.Client.GetAsync($"/api/parties/public/{shortCode}/state");
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var state = result.RootElement.GetProperty("playbackState");

        Assert.That(response.IsSuccessStatusCode, Is.True);
        Assert.That(result.RootElement.GetProperty("partyId").GetString(), Is.EqualTo(partyId.ToString()));
        Assert.That(result.RootElement.GetProperty("isSessionActive").GetBoolean(), Is.True);
        Assert.That(result.RootElement.GetProperty("playlist").GetProperty("items")[0].GetProperty("id").GetString(), Is.EqualTo("restart-track"));
        Assert.That(state.GetProperty("currentTrackId").GetString(), Is.EqualTo("restart-track"));
        Assert.That(state.GetProperty("position").GetDouble(), Is.EqualTo(18.75));
        Assert.That(state.GetProperty("playedTrackIds")[0].GetString(), Is.EqualTo("restart-track"));
        Assert.That(state.GetProperty("disabledTrackIds")[0].GetString(), Is.EqualTo("disabled-track"));
    }

    [Test]
    [Category("ContainerRestartFreezePrepare")]
    public async Task SYS02_PrepareEndedSessionFreezeForServerRestart()
    {
        var partyId = ReadGuid(FreezePartyIdVariable, DefaultFreezePartyId);
        var shortCode = ReadString(FreezeShortCodeVariable, "itrestart02");
        await using var context = await ContainerIntegrationTestContext.CreateRestartContextAsync(OrganizerId, SessionId);
        await context.CreateRestartPartyAsync(partyId, shortCode);
        await context.AddPlaylistAsync(partyId, "[{\"id\":\"freeze-track\",\"type\":\"track\",\"name\":\"Freeze track\",\"displayOrder\":0,\"level\":0,\"duration\":180}]");
        await using var hub = await ConnectOrganizerAsync(context);
        await hub.InvokeAsync("JoinPartyAsOrganizer", partyId.ToString(), context.Token);
        await hub.InvokeAsync("StartSession", partyId.ToString());
        await hub.InvokeAsync("UpdateFullState", partyId.ToString(), new { currentTrackId = "freeze-track", status = "playing", position = 72.25, duration = 180d, volume = 0.65d, mode = "preparation", playedTrackIds = new[] { "freeze-track" }, disabledTrackIds = new[] { "disabled-track" }, disabledGroupIds = new[] { "disabled-group" } });
        await hub.InvokeAsync("EndSession", partyId.ToString());
        using var response = await context.Client.GetAsync($"/api/parties/public/{shortCode}/state");
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(result.RootElement.GetProperty("isSessionActive").GetBoolean(), Is.False);
        Assert.That(result.RootElement.GetProperty("playbackState").GetProperty("status").GetString(), Is.EqualTo("ended"));
    }

    [Test]
    [Category("ContainerRestartFreezeVerify")]
    public async Task SYS02_VerifyEndedSessionFreezeAfterServerRestart()
    {
        var partyId = ReadGuid(FreezePartyIdVariable, DefaultFreezePartyId);
        var shortCode = ReadString(FreezeShortCodeVariable, "itrestart02");
        await using var context = await ContainerIntegrationTestContext.CreateRestartContextAsync(OrganizerId, SessionId);
        using var response = await context.Client.GetAsync($"/api/parties/public/{shortCode}/state");
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var state = result.RootElement.GetProperty("playbackState");

        Assert.That(response.IsSuccessStatusCode, Is.True);
        Assert.That(result.RootElement.GetProperty("partyId").GetString(), Is.EqualTo(partyId.ToString()));
        Assert.That(result.RootElement.GetProperty("isSessionActive").GetBoolean(), Is.False);
        Assert.That(state.GetProperty("status").GetString(), Is.EqualTo("ended"));
        Assert.That(state.GetProperty("position").GetDouble(), Is.EqualTo(72.25));
        Assert.That(state.GetProperty("playedTrackIds")[0].GetString(), Is.EqualTo("freeze-track"));
        Assert.That(state.GetProperty("disabledTrackIds")[0].GetString(), Is.EqualTo("disabled-track"));
    }

    private static async Task<HubConnection> ConnectOrganizerAsync(ContainerIntegrationTestContext context)
    {
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(context.Client.BaseAddress!, "partyHub"), options =>
                options.AccessTokenProvider = () => Task.FromResult<string?>(context.Token))
            .Build();
        await connection.StartAsync();
        return connection;
    }

    private static Guid ReadGuid(string name, Guid fallback) =>
        Guid.TryParse(Environment.GetEnvironmentVariable(name), out var value) ? value : fallback;

    private static string ReadString(string name, string fallback) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } value ? value : fallback;
}
