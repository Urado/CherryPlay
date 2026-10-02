using System.Net;
using System.Text.Json;

namespace CherryPlayServer.Tests;

[TestFixture]
[Category("ContainerIntegration")]
[NonParallelizable]
public sealed class ContainerHttpIntegrationTests
{
    private ContainerIntegrationTestContext _context = null!;
    private Guid _partyId;

    [SetUp]
    public async Task SetUp()
    {
        _context = await ContainerIntegrationTestContext.CreateAsync();
        _partyId = await _context.CreatePartyAsync();
    }

    [TearDown]
    public async Task TearDown()
    {
        if (_context is not null)
        {
            await _context.DisposeAsync();
        }
    }

    [TestCase(null, HttpStatusCode.Unauthorized)]
    [TestCase("invalid", HttpStatusCode.Unauthorized)]
    public async Task HTTP01_UnauthenticatedOrMalformedJwtIsRejected(string? token, HttpStatusCode expected)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/parties/{_partyId}");
        if (token is not null)
        {
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        }

        using var response = await _context.Client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(expected));
    }

    [Test]
    public async Task HTTP01_ValidShapeWithWrongSigningKeyIsRejected()
    {
        using var request = _context.Authenticated(HttpMethod.Get, $"/api/parties/{_partyId}", token: _context.TokenWithWrongKey());

        using var response = await _context.Client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task HTTP02_OtherOrganizerCannotReadOrMutateParty()
    {
        var otherOrganizerId = await _context.CreateAdditionalOrganizerAsync();
        var otherPartyId = await _context.CreatePartyAsync(organizerId: otherOrganizerId);
        await _context.AddPlaylistAsync(otherPartyId, "[{\"id\":\"protected-track\",\"type\":\"track\",\"name\":\"Protected\",\"displayOrder\":0,\"level\":0,\"duration\":90}]");
        await _context.AddSessionStateAsync(otherPartyId, position: 14.5);
        using var read = _context.Authenticated(HttpMethod.Get, $"/api/parties/{otherPartyId}");
        using var request = _context.Authenticated(HttpMethod.Put, $"/api/parties/{otherPartyId}", ContainerIntegrationTestContext.Json("{\"name\":\"unauthorized\"}"));
        using var playlist = _context.Authenticated(HttpMethod.Put, $"/api/parties/{otherPartyId}/playlist", ContainerIntegrationTestContext.Json("{\"items\":[],\"totalDuration\":0,\"totalTracks\":0}"));
        using var lifecycle = _context.Authenticated(HttpMethod.Post, $"/api/parties/{otherPartyId}/lifecycle", ContainerIntegrationTestContext.Json("{\"partyLifecycleState\":\"completed\"}"));
        using var delete = _context.Authenticated(HttpMethod.Delete, $"/api/parties/{otherPartyId}");

        using var readResponse = await _context.Client.SendAsync(read);
        using var response = await _context.Client.SendAsync(request);
        using var playlistResponse = await _context.Client.SendAsync(playlist);
        using var lifecycleResponse = await _context.Client.SendAsync(lifecycle);
        using var deleteResponse = await _context.Client.SendAsync(delete);

        Assert.That(readResponse.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(playlistResponse.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(lifecycleResponse.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(deleteResponse.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(await _context.GetPartyNameAsync(otherPartyId), Does.StartWith("Container test"));
        using var publicParty = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(otherPartyId)}");
        using var publicState = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(otherPartyId)}/state");
        using var party = JsonDocument.Parse(await publicParty.Content.ReadAsStringAsync());
        using var state = JsonDocument.Parse(await publicState.Content.ReadAsStringAsync());
        Assert.That(publicParty.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(party.RootElement.GetProperty("partyLifecycleState").GetString(), Is.EqualTo("ready"));
        Assert.That(state.RootElement.GetProperty("playlist").GetProperty("items")[0].GetProperty("id").GetString(), Is.EqualTo("protected-track"));
        Assert.That(state.RootElement.GetProperty("playbackState").GetProperty("position").GetDouble(), Is.EqualTo(14.5));
    }

    [Test]
    public async Task HTTP03_LogoutRevokesPreviouslyValidTokenWithoutChangingPartyData()
    {
        var beforeName = await _context.GetPartyNameAsync(_partyId);
        using var logout = _context.Authenticated(HttpMethod.Post, "/auth/logout");
        using var logoutResponse = await _context.Client.SendAsync(logout);
        using var request = _context.Authenticated(HttpMethod.Get, $"/api/parties/{_partyId}");

        using var response = await _context.Client.SendAsync(request);

        Assert.That(logoutResponse.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(await _context.GetPartyNameAsync(_partyId), Is.EqualTo(beforeName));
    }

    [Test]
    public async Task HTTP03_PasswordChangeRevokesOtherPreviouslyIssuedSessions()
    {
        const string oldPassword = "container-old-password-123";
        await _context.AddEmailAccountAsync(oldPassword);
        var secondIssuedToken = await _context.CreateAdditionalSessionTokenAsync();
        var beforeName = await _context.GetPartyNameAsync(_partyId);
        using var change = _context.Authenticated(HttpMethod.Post, "/auth/change-password", ContainerIntegrationTestContext.Json("{\"oldPassword\":\"container-old-password-123\",\"newPassword\":\"container-new-password-123\"}"));
        using var changeResponse = await _context.Client.SendAsync(change);
        using var request = _context.Authenticated(HttpMethod.Get, $"/api/parties/{_partyId}");

        using var response = await _context.Client.SendAsync(request);
        using var secondSessionRequest = _context.Authenticated(HttpMethod.Get, $"/api/parties/{_partyId}", token: secondIssuedToken);
        using var secondSessionResponse = await _context.Client.SendAsync(secondSessionRequest);

        Assert.That(changeResponse.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(secondSessionResponse.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(await _context.GetPartyNameAsync(_partyId), Is.EqualTo(beforeName));
    }

    [Test]
    public async Task HTTP03_PasswordResetRevokesAllPreviouslyIssuedSessions()
    {
        var emailAccountId = await _context.AddEmailAccountAsync("container-old-password-123");
        var resetToken = await _context.CreatePasswordResetTokenAsync(emailAccountId);
        var secondIssuedToken = await _context.CreateAdditionalSessionTokenAsync();
        var beforeName = await _context.GetPartyNameAsync(_partyId);
        using var reset = new HttpRequestMessage(HttpMethod.Post, "/auth/reset-password")
        {
            Content = ContainerIntegrationTestContext.Json(JsonSerializer.Serialize(new { token = resetToken, newPassword = "container-reset-password-123" }))
        };
        using var resetResponse = await _context.Client.SendAsync(reset);
        using var firstSessionRequest = _context.Authenticated(HttpMethod.Get, $"/api/parties/{_partyId}");
        using var secondSessionRequest = _context.Authenticated(HttpMethod.Get, $"/api/parties/{_partyId}", token: secondIssuedToken);
        using var firstSessionResponse = await _context.Client.SendAsync(firstSessionRequest);
        using var secondSessionResponse = await _context.Client.SendAsync(secondSessionRequest);

        Assert.That(resetResponse.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(firstSessionResponse.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(secondSessionResponse.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(await _context.GetPartyNameAsync(_partyId), Is.EqualTo(beforeName));
    }

    [Test]
    public async Task HTTP01_ExpiredJwtIsRejected()
    {
        using var request = _context.Authenticated(HttpMethod.Get, $"/api/parties/{_partyId}", token: _context.ExpiredToken());

        using var response = await _context.Client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task HTTP04_DeletedAccountInvalidatesAccessTokenAndDesktopCode()
    {
        var desktopCode = await _context.CreateDesktopCodeAsync();
        using var deletion = _context.Authenticated(HttpMethod.Delete, "/api/organizer/account");
        using var deletionResponse = await _context.Client.SendAsync(deletion);
        using var request = _context.Authenticated(HttpMethod.Get, $"/api/parties/{_partyId}");
        using var exchange = new HttpRequestMessage(HttpMethod.Post, "/auth/desktop/exchange")
        {
            Content = ContainerIntegrationTestContext.Json(JsonSerializer.Serialize(new { code = desktopCode }))
        };

        using var response = await _context.Client.SendAsync(request);
        using var exchangeResponse = await _context.Client.SendAsync(exchange);

        Assert.That(deletionResponse.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(exchangeResponse.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task HTTP05_AdminEndpointRejectsOrganizerRole()
    {
        using var request = _context.Authenticated(HttpMethod.Get, "/api/admin/theme-packages");

        using var response = await _context.Client.SendAsync(request);
        using var staleAdminRequest = _context.Authenticated(HttpMethod.Get, "/api/admin/theme-packages", token: _context.TokenWithRole("admin"));
        using var staleAdminResponse = await _context.Client.SendAsync(staleAdminRequest);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That(staleAdminResponse.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
    }

    [Test]
    public async Task HTTP06_CreateAndReadPartyPreservesMetadataAndShortCode()
    {
        var payload = "{\"name\":\"API integration party\",\"title\":\"Title\",\"subtitle\":\"Subtitle\",\"description\":\"Description\",\"city\":\"Moscow\",\"isListedInCatalog\":true}";
        using var create = _context.Authenticated(HttpMethod.Post, "/api/parties", ContainerIntegrationTestContext.Json(payload));
        using var created = await _context.Client.SendAsync(create);
        Assert.That(created.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        using var createdJson = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        var id = createdJson.RootElement.GetProperty("id").GetGuid();
        var shortCode = createdJson.RootElement.GetProperty("shortCode").GetString();
        using var read = _context.Authenticated(HttpMethod.Get, $"/api/parties/{id}");
        using var response = await _context.Client.SendAsync(read);
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(result.RootElement.GetProperty("title").GetString(), Is.EqualTo("Title"));
        Assert.That(result.RootElement.GetProperty("subtitle").GetString(), Is.EqualTo("Subtitle"));
        Assert.That(result.RootElement.GetProperty("shortCode").GetString(), Is.EqualTo(shortCode));
        using var publish = _context.Authenticated(HttpMethod.Put, $"/api/parties/{id}/playlist", ContainerIntegrationTestContext.Json("{\"items\":[{\"id\":\"roundtrip-track\",\"type\":\"track\",\"name\":\"Roundtrip\",\"displayOrder\":0,\"level\":0,\"duration\":75}],\"totalDuration\":75,\"totalTracks\":1}"));
        using var published = await _context.Client.SendAsync(publish);
        using var playlist = await _context.Client.GetAsync($"/api/parties/public/{shortCode}/playlist");
        using var playlistJson = JsonDocument.Parse(await playlist.Content.ReadAsStringAsync());
        Assert.That(published.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(playlistJson.RootElement.GetProperty("items")[0].GetProperty("id").GetString(), Is.EqualTo("roundtrip-track"));
    }

    [Test]
    public async Task HTTP07_PartialMetadataUpdatePreservesOtherFields()
    {
        await _context.AddPlaylistAsync(_partyId, "[{\"id\":\"before-track\",\"type\":\"track\",\"name\":\"Before\",\"displayOrder\":0,\"level\":0,\"duration\":90}]");
        await _context.AddSessionStateAsync(_partyId, position: 17.25);
        using var update = _context.Authenticated(HttpMethod.Put, $"/api/parties/{_partyId}", ContainerIntegrationTestContext.Json("{\"title\":\"Changed\"}"));
        using var updated = await _context.Client.SendAsync(update);
        using var read = _context.Authenticated(HttpMethod.Get, $"/api/parties/{_partyId}");
        using var response = await _context.Client.SendAsync(read);
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(updated.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(result.RootElement.GetProperty("name").GetString(), Does.Contain("Container test"));
        Assert.That(result.RootElement.GetProperty("title").GetString(), Is.EqualTo("Changed"));
        using var publicState = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(_partyId)}/state");
        using var state = JsonDocument.Parse(await publicState.Content.ReadAsStringAsync());
        Assert.That(state.RootElement.GetProperty("playlist").GetProperty("items")[0].GetProperty("id").GetString(), Is.EqualTo("before-track"));
        Assert.That(state.RootElement.GetProperty("playbackState").GetProperty("position").GetDouble(), Is.EqualTo(17.25));
    }

    [Test]
    public async Task HTTP08_PublishPlaylistReplacesPriorVersionAndEnforcesLimit()
    {
        using var publish = _context.Authenticated(HttpMethod.Put, $"/api/parties/{_partyId}/playlist", ContainerIntegrationTestContext.Json("{\"items\":[{\"id\":\"replacement\",\"type\":\"track\",\"name\":\"Replacement\",\"displayOrder\":0,\"level\":0,\"duration\":90}],\"totalDuration\":90,\"totalTracks\":1}"));
        using var response = await _context.Client.SendAsync(publish);
        using var read = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(_partyId)}/playlist");
        using var result = JsonDocument.Parse(await read.Content.ReadAsStringAsync());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(result.RootElement.GetProperty("items")[0].GetProperty("id").GetString(), Is.EqualTo("replacement"));

        using var oversized = _context.Authenticated(HttpMethod.Put, $"/api/parties/{_partyId}/playlist", ContainerIntegrationTestContext.Json("{\"items\":[],\"totalDuration\":0,\"totalTracks\":10001}"));
        using var rejected = await _context.Client.SendAsync(oversized);
        using var readAgain = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(_partyId)}/playlist");
        using var unchanged = JsonDocument.Parse(await readAgain.Content.ReadAsStringAsync());
        Assert.That(rejected.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That(unchanged.RootElement.GetProperty("items")[0].GetProperty("id").GetString(), Is.EqualTo("replacement"));
    }

    [Test]
    public async Task HTTP09_InvalidLifecycleTransitionReturnsConflictContract()
    {
        using var allowed = _context.Authenticated(HttpMethod.Post, $"/api/parties/{_partyId}/lifecycle", ContainerIntegrationTestContext.Json("{\"partyLifecycleState\":\"completed\"}"));
        using var allowedResponse = await _context.Client.SendAsync(allowed);
        using var same = _context.Authenticated(HttpMethod.Post, $"/api/parties/{_partyId}/lifecycle", ContainerIntegrationTestContext.Json("{\"partyLifecycleState\":\"completed\"}"));
        using var sameResponse = await _context.Client.SendAsync(same);
        using var request = _context.Authenticated(HttpMethod.Post, $"/api/parties/{_partyId}/lifecycle", ContainerIntegrationTestContext.Json("{\"partyLifecycleState\":\"draft\"}"));

        using var response = await _context.Client.SendAsync(request);
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Conflict));
        Assert.That(allowedResponse.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(sameResponse.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(result.RootElement.GetProperty("code").GetString(), Is.EqualTo("invalid_lifecycle_transition"));
        Assert.That(result.RootElement.GetProperty("currentState").GetString(), Is.EqualTo("completed"));
        Assert.That(result.RootElement.GetProperty("requestedState").GetString(), Is.EqualTo("draft"));
    }

    [Test]
    public async Task HTTP10_ChangingToUnentitledThemeIsForbidden()
    {
        using var metadata = _context.Authenticated(HttpMethod.Put, $"/api/parties/{_partyId}", ContainerIntegrationTestContext.Json("{\"title\":\"Metadata still editable\"}"));
        using var metadataResponse = await _context.Client.SendAsync(metadata);
        using var request = _context.Authenticated(HttpMethod.Put, $"/api/parties/{_partyId}", ContainerIntegrationTestContext.Json("{\"partyThemeId\":\"cyberpunk\"}"));

        using var response = await _context.Client.SendAsync(request);

        Assert.That(metadataResponse.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
    }

    [Test]
    public async Task HTTP11_CatalogIncludesListedReadyAndCompletedButExcludesDraftAndUnlisted()
    {
        var completed = await _context.CreatePartyAsync(lifecycleState: "completed");
        var draft = await _context.CreatePartyAsync(lifecycleState: "draft");
        var unlisted = await _context.CreatePartyAsync(listed: false);
        using var response = await _context.Client.GetAsync("/api/parties/public/list");
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var ids = result.RootElement.EnumerateArray().Select(item => item.GetProperty("id").GetGuid()).ToHashSet();

        Assert.That(ids, Does.Contain(_partyId));
        Assert.That(ids, Does.Contain(completed));
        Assert.That(ids, Does.Not.Contain(draft));
        Assert.That(ids, Does.Not.Contain(unlisted));
        using var directLink = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(unlisted)}");
        Assert.That(directLink.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task HTTP12_DeletePartyRemovesPublicAndOrganizerAccess()
    {
        await _context.AddSessionStateAsync(_partyId);
        using var delete = _context.Authenticated(HttpMethod.Delete, $"/api/parties/{_partyId}");
        using var deleted = await _context.Client.SendAsync(delete);
        using var read = _context.Authenticated(HttpMethod.Get, $"/api/parties/{_partyId}");
        using var response = await _context.Client.SendAsync(read);
        using var publicRead = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(_partyId)}");
        using var publicState = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(_partyId)}/state");

        Assert.That(deleted.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(publicRead.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(publicState.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));
        Assert.That(await _context.PartyExistsAsync(_partyId), Is.True);
        Assert.That(await _context.SessionStateExistsAsync(_partyId), Is.False);
    }

    [Test]
    public async Task HTTP13_PublicStateReturnsPersistedPlaylistWithoutAuthentication()
    {
        await _context.AddPlaylistAsync(_partyId, "[{\"id\":\"track-a\",\"type\":\"track\",\"name\":\"Track A\",\"displayOrder\":0,\"level\":0,\"duration\":90}]");
        await _context.AddSessionStateAsync(_partyId, position: 45.5);
        using var response = await _context.Client.GetAsync($"/api/parties/public/{_context.ShortCodeFor(_partyId)}/state");
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(result.RootElement.GetProperty("playlist").GetProperty("items")[0].GetProperty("id").GetString(), Is.EqualTo("track-a"));
        Assert.That(result.RootElement.GetProperty("playbackState").GetProperty("position").GetDouble(), Is.EqualTo(45.5));
        Assert.That(result.RootElement.GetProperty("partyDisplayStatus").GetString(), Is.Not.Empty);
    }

    [Test]
    public async Task HTTP14_InvalidPartyIdentifierReturnsBadRequestWithoutInternalDetails()
    {
        using var request = _context.Authenticated(HttpMethod.Get, "/api/parties/not-a-guid");
        using var unauthenticated = new HttpRequestMessage(HttpMethod.Get, $"/api/parties/{_partyId}");

        using var response = await _context.Client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest));
        Assert.That(body, Does.Not.Contain("Npgsql"));
        Assert.That(body, Does.Not.Contain("Exception"));
        using var unauthorizedResponse = await _context.Client.SendAsync(unauthenticated);
        Assert.That(unauthorizedResponse.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));

        using var missing = _context.Authenticated(HttpMethod.Get, $"/api/parties/{Guid.NewGuid()}");
        using var missingResponse = await _context.Client.SendAsync(missing);
        Assert.That(missingResponse.StatusCode, Is.EqualTo(HttpStatusCode.NotFound));

        var otherOrganizerId = await _context.CreateAdditionalOrganizerAsync();
        var otherPartyId = await _context.CreatePartyAsync(organizerId: otherOrganizerId);
        using var forbidden = _context.Authenticated(HttpMethod.Put, $"/api/parties/{otherPartyId}", ContainerIntegrationTestContext.Json("{\"name\":\"still allowed\"}"));
        using var forbiddenResponse = await _context.Client.SendAsync(forbidden);
        Assert.That(forbiddenResponse.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));

        using var conflict = _context.Authenticated(HttpMethod.Post, $"/api/parties/{_partyId}/lifecycle", ContainerIntegrationTestContext.Json("{\"partyLifecycleState\":\"draft\"}"));
        using var conflictResponse = await _context.Client.SendAsync(conflict);
        Assert.That(conflictResponse.StatusCode, Is.EqualTo(HttpStatusCode.Conflict));
    }
}
