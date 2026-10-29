using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;

namespace CherryPlayServer.Tests;

[TestFixture]
[NonParallelizable]
[Category("AdminPartyInMemoryIntegration")]
public sealed class AdminSecurityHttpIntegrationTests
{
    private AdminSecurityInMemoryWebApplicationFactory _factory = null!;
    private HttpClient _client = null!;

    [SetUp]
    public void SetUp()
    {
        _factory = new AdminSecurityInMemoryWebApplicationFactory();
        _client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = false
        });
    }

    [TearDown]
    public void TearDown()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    [TestCase("GET", "/api/admin/theme-packages")]
    [TestCase("GET", "/api/admin/organizers")]
    [TestCase("GET", "/api/admin/organizers/00000000-0000-0000-0000-000000000001")]
    [TestCase("GET", "/api/admin/organizers/00000000-0000-0000-0000-000000000001/entitlements")]
    [TestCase("GET", "/api/admin/entitlements/00000000-0000-0000-0000-000000000001")]
    [TestCase("GET", "/api/admin/entitlement-revocations?entitlementId=00000000-0000-0000-0000-000000000001")]
    [TestCase("GET", "/api/admin/entitlement-revocations/00000000-0000-0000-0000-000000000001")]
    [TestCase("POST", "/api/admin/entitlement-revocations")]
    [TestCase("POST", "/api/admin/organizers/00000000-0000-0000-0000-000000000001/entitlements")]
    [TestCase("DELETE", "/api/admin/organizers/00000000-0000-0000-0000-000000000001/entitlements/00000000-0000-0000-0000-000000000002")]
    public async Task AdminEndpoint_AnonymousRequest_IsRejected(string method, string path)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), path);
        request.Content = new StringContent("{}", Encoding.UTF8, "application/json");

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), await response.Content.ReadAsStringAsync());
    }

    [TestCase("GET", "/api/admin/theme-packages")]
    [TestCase("GET", "/api/admin/organizers")]
    [TestCase("GET", "/api/admin/organizers/00000000-0000-0000-0000-000000000001")]
    [TestCase("GET", "/api/admin/organizers/00000000-0000-0000-0000-000000000001/entitlements")]
    [TestCase("GET", "/api/admin/entitlements/00000000-0000-0000-0000-000000000001")]
    [TestCase("GET", "/api/admin/entitlement-revocations?entitlementId=00000000-0000-0000-0000-000000000001")]
    [TestCase("GET", "/api/admin/entitlement-revocations/00000000-0000-0000-0000-000000000001")]
    [TestCase("POST", "/api/admin/entitlement-revocations")]
    [TestCase("POST", "/api/admin/organizers/00000000-0000-0000-0000-000000000001/entitlements")]
    [TestCase("DELETE", "/api/admin/organizers/00000000-0000-0000-0000-000000000001/entitlements/00000000-0000-0000-0000-000000000002")]
    public async Task AdminEndpoint_OrganizerRequest_IsRejected(string method, string path)
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Organizer);
        using var request = new HttpRequestMessage(new HttpMethod(method), path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = new StringContent("{}", Encoding.UTF8, "application/json");

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden), await response.Content.ReadAsStringAsync());
    }

    [Test]
    public async Task AdminEndpoint_InvalidBearerAndAdminCookie_DoesNotFallBackToCookie()
    {
        var adminToken = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/admin/organizers");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "forged-token");
        request.Headers.Add("Cookie", $"{AuthConstants.AuthCookieName}={adminToken}");

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task AdminEndpoint_OrganizerDatabaseRoleWithAdminTokenClaim_IsRejected()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Organizer, tokenRole: "admin");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/admin/organizers");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
    }

    [Test]
    public async Task OrganizerEndpoint_SessionBelongsToDifferentOrganizer_IsRejected()
    {
        using var scope = _factory.Services.CreateScope();
        var organizerRepository = scope.ServiceProvider.GetRequiredService<IOrganizerRepository>();
        var sessionRepository = scope.ServiceProvider.GetRequiredService<IOrganizerSessionRepository>();
        var jwtService = scope.ServiceProvider.GetRequiredService<IJwtService>();
        var firstOrganizerId = Guid.NewGuid();
        var secondOrganizerId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        await organizerRepository.AddAsync(new Organizer { Id = firstOrganizerId, Name = "First organizer" });
        await organizerRepository.AddAsync(new Organizer { Id = secondOrganizerId, Name = "Second organizer" });
        await sessionRepository.AddAsync(new OrganizerSession { Id = sessionId, OrganizerId = secondOrganizerId });
        var token = await jwtService.GenerateTokenAsync(firstOrganizerId, "First organizer", sessionId, "organizer");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/organizer/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task AdminEndpoint_ReplayedTokenAfterLogout_IsRejected()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        using var logoutRequest = new HttpRequestMessage(HttpMethod.Post, "/auth/logout");
        logoutRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var logoutResponse = await _client.SendAsync(logoutRequest);
        Assert.That(logoutResponse.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        using var adminRequest = new HttpRequestMessage(HttpMethod.Get, "/api/admin/organizers");
        adminRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var adminResponse = await _client.SendAsync(adminRequest);

        Assert.That(adminResponse.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), await adminResponse.Content.ReadAsStringAsync());
    }

    [Test]
    public async Task AdminPartyCollection_AnonymousRequest_IsRejected()
    {
        using var response = await _client.GetAsync("/api/admin/parties");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), await response.Content.ReadAsStringAsync());
    }

    [Test]
    public async Task AdminPartyCollection_InvalidBearer_IsRejected()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/admin/parties");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "tampered-token");

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), await response.Content.ReadAsStringAsync());
    }

    [TestCase("GET", "/api/admin/parties/00000000-0000-0000-0000-000000000001")]
    [TestCase("POST", "/api/admin/parties/00000000-0000-0000-0000-000000000001/session-resets")]
    public async Task AdminPartyDetailAndReset_AnonymousRequestsAreRejected(string method, string path)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), path);
        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [TestCase("list", "anonymous", HttpStatusCode.Unauthorized)]
    [TestCase("list", "invalid", HttpStatusCode.Unauthorized)]
    [TestCase("list", "organizer", HttpStatusCode.Forbidden)]
    [TestCase("lifecycle", "anonymous", HttpStatusCode.Unauthorized)]
    [TestCase("lifecycle", "invalid", HttpStatusCode.Unauthorized)]
    [TestCase("lifecycle", "organizer", HttpStatusCode.Forbidden)]
    [TestCase("visibility", "anonymous", HttpStatusCode.Unauthorized)]
    [TestCase("visibility", "invalid", HttpStatusCode.Unauthorized)]
    [TestCase("visibility", "organizer", HttpStatusCode.Forbidden)]
    public async Task AdminPartyEndpoint_InvalidCredential_IsRejectedWithoutPartyChanges(
        string endpoint,
        string credential,
        HttpStatusCode expectedStatus)
    {
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        var token = credential == "organizer" ? await CreateIdentityTokenAsync(OrganizerRole.Organizer) : null;
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IPartyRepository>();
        var original = await repository.GetByIdAsync(partyId);
        var path = endpoint switch
        {
            "list" => "/api/admin/parties?page=1&pageSize=20",
            "lifecycle" => $"/api/admin/parties/{partyId}/lifecycle",
            _ => $"/api/admin/parties/{partyId}/catalog-visibility"
        };
        using var request = endpoint == "list"
            ? new HttpRequestMessage(HttpMethod.Get, path)
            : new HttpRequestMessage(HttpMethod.Patch, path)
            {
                Content = endpoint == "lifecycle"
                    ? JsonContent(new { partyLifecycleState = "completed" })
                    : JsonContent(new { isListedInCatalog = false })
            };
        if (credential == "invalid")
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "tampered-token");
        }
        else if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        using var response = await _client.SendAsync(request);
        var saved = await repository.GetByIdAsync(partyId);

        Assert.That(response.StatusCode, Is.EqualTo(expectedStatus), await response.Content.ReadAsStringAsync());
        Assert.That(saved?.PartyLifecycleState, Is.EqualTo(original?.PartyLifecycleState));
        Assert.That(saved?.IsListedInCatalog, Is.EqualTo(original?.IsListedInCatalog));
    }

    [TestCase("list")]
    [TestCase("lifecycle")]
    [TestCase("visibility")]
    public async Task AdminPartyEndpoint_RevokedSession_IsRejectedWithoutPartyChanges(string endpoint)
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IPartyRepository>();
        using var logout = new HttpRequestMessage(HttpMethod.Post, "/auth/logout");
        logout.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var logoutResponse = await _client.SendAsync(logout);
        Assert.That(logoutResponse.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));

        var request = endpoint switch
        {
            "list" => new HttpRequestMessage(HttpMethod.Get, "/api/admin/parties?page=1&pageSize=20"),
            "lifecycle" => new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
            {
                Content = JsonContent(new { partyLifecycleState = "completed" })
            },
            _ => new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/catalog-visibility")
            {
                Content = JsonContent(new { isListedInCatalog = false })
            }
        };
        using (request)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            using var response = await _client.SendAsync(request);
            var saved = await repository.GetByIdAsync(partyId);

            Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized), await response.Content.ReadAsStringAsync());
            Assert.That(saved?.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
            Assert.That(saved?.IsListedInCatalog, Is.True);
        }
    }

    [Test]
    public async Task AdminPartyCollection_AdminRequest_ReturnsPagedResource()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.GetAsync("/api/admin/parties?page=1&pageSize=20");
        var body = await response.Content.ReadAsStringAsync();

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
        using var document = JsonDocument.Parse(body);
        Assert.That(document.RootElement.TryGetProperty("items", out _), Is.True);
        Assert.That(document.RootElement.TryGetProperty("total", out _), Is.True);
        Assert.That(document.RootElement.GetProperty("page").GetInt32(), Is.EqualTo(1));
        Assert.That(document.RootElement.GetProperty("pageSize").GetInt32(), Is.EqualTo(20));
    }

    [Test]
    public async Task AdminPartyDetail_ReturnsHiddenPartyCard()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, false);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/admin/parties/{partyId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
        using var document = JsonDocument.Parse(body);
        Assert.That(document.RootElement.GetProperty("id").GetGuid(), Is.EqualTo(partyId));
        Assert.That(document.RootElement.GetProperty("city").GetString(), Is.EqualTo("Moscow"));
        Assert.That(document.RootElement.GetProperty("isListedInCatalog").GetBoolean(), Is.False);
        Assert.That(document.RootElement.GetProperty("playlist").GetProperty("items").GetArrayLength(), Is.Zero);
    }

    [Test]
    public async Task AdminPartySessionReset_WithoutPersistedSessionIsIdempotent()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/admin/parties/{partyId}/session-resets");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
        using var document = JsonDocument.Parse(body);
        Assert.That(document.RootElement.GetProperty("wasReset").GetBoolean(), Is.False);
        Assert.That(document.RootElement.GetProperty("hasActiveSession").GetBoolean(), Is.False);
        Assert.That(document.RootElement.GetProperty("playbackState").ValueKind, Is.EqualTo(JsonValueKind.Null));
        using var scope = _factory.Services.CreateScope();
        Assert.That(await scope.ServiceProvider.GetRequiredService<IStreamingRepository>().GetSessionStateAsync(partyId), Is.Null);
    }

    [TestCase("page=0")]
    [TestCase("pageSize=0")]
    [TestCase("partyLifecycleState=invalid")]
    public async Task AdminPartyCollection_InvalidFilterOrPaging_IsRejected(string query)
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/admin/parties?{query}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), await response.Content.ReadAsStringAsync());
    }

    [Test]
    public async Task AdminEndpoint_RevokedDatabaseRole_RejectsExistingToken()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        using (var scope = _factory.Services.CreateScope())
        {
            var decoded = await scope.ServiceProvider.GetRequiredService<IJwtService>().ValidateTokenAsync(token);
            var organizerRepository = scope.ServiceProvider.GetRequiredService<IOrganizerRepository>();
            var organizer = await organizerRepository.GetByIdAsync(decoded.OrganizerId!.Value);
            organizer!.Role = OrganizerRole.Organizer;
            await organizerRepository.UpdateAsync(organizer);
        }
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/admin/organizers");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
    }

    [Test]
    public async Task AdminEndpoint_CrossOriginPreflight_DoesNotGrantUntrustedOrigin()
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/admin/parties/00000000-0000-0000-0000-000000000001/lifecycle");
        request.Headers.Add("Origin", "https://attacker.example");
        request.Headers.Add("Access-Control-Request-Method", "PATCH");
        request.Headers.Add("Access-Control-Request-Headers", "authorization,content-type");

        using var response = await _client.SendAsync(request);

        Assert.That(response.Headers.Contains("Access-Control-Allow-Origin"), Is.False);
    }

    [Test]
    public async Task AdminPartyMutation_CrossOriginCookieRequest_IsRejectedWithoutChangingParty()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IPartyRepository>();
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new { partyLifecycleState = "draft" })
        };
        request.Headers.Add("Cookie", $"{AuthConstants.AuthCookieName}={token}");
        request.Headers.Add("Origin", "https://attacker.example");

        using var response = await _client.SendAsync(request);
        var savedParty = await repository.GetByIdAsync(partyId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden), await response.Content.ReadAsStringAsync());
        Assert.That(savedParty?.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
    }

    [Test]
    public async Task AdminPartyMutation_TrustedPublicWebCookieOrigin_IsAcceptedBehindProxy()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IPartyRepository>();
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new { partyLifecycleState = "draft" })
        };
        request.Headers.Add("Cookie", $"{AuthConstants.AuthCookieName}={token}");
        request.Headers.Add("Origin", "https://web.example");
        request.Headers.Add("Referer", "https://attacker.example/admin/parties");

        using var response = await _client.SendAsync(request);
        var savedParty = await repository.GetByIdAsync(partyId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), await response.Content.ReadAsStringAsync());
        Assert.That(savedParty?.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Draft));
    }

    [Test]
    public async Task AdminPartyMutation_TrustedRefererWithoutOrigin_IsAccepted()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IPartyRepository>();
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new { partyLifecycleState = "draft" })
        };
        request.Headers.Add("Cookie", $"{AuthConstants.AuthCookieName}={token}");
        request.Headers.Add("Referer", "https://web.example/admin/parties");

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), await response.Content.ReadAsStringAsync());
        Assert.That((await repository.GetByIdAsync(partyId))?.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Draft));
    }

    [Test]
    public async Task AdminPartyMutation_CookieWithoutOriginAndReferer_IsRejectedWithoutChangingParty()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IPartyRepository>();
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new { partyLifecycleState = "draft" })
        };
        request.Headers.Add("Cookie", $"{AuthConstants.AuthCookieName}={token}");

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That((await repository.GetByIdAsync(partyId))?.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
    }

    [Test]
    public async Task AdminPartyMutation_UntrustedReferer_IsRejectedWithoutChangingParty()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IPartyRepository>();
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new { partyLifecycleState = "draft" })
        };
        request.Headers.Add("Cookie", $"{AuthConstants.AuthCookieName}={token}");
        request.Headers.Add("Referer", "https://attacker.example/admin/parties");

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That((await repository.GetByIdAsync(partyId))?.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
    }

    [TestCase("ftp://web.example")]
    [TestCase("https://web.example, https://attacker.example")]
    public async Task AdminPartyMutation_InvalidOrMultipleOrigin_IsRejectedEvenWithTrustedReferer(string origin)
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IPartyRepository>();
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new { partyLifecycleState = "draft" })
        };
        request.Headers.Add("Cookie", $"{AuthConstants.AuthCookieName}={token}");
        request.Headers.TryAddWithoutValidation("Origin", origin);
        request.Headers.Add("Referer", "https://web.example/admin/parties");

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden));
        Assert.That((await repository.GetByIdAsync(partyId))?.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
    }

    [Test]
    public async Task AdminPartyMutation_UndefinedNumericLifecycle_ReturnsBadRequestWithoutChangingParty()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IPartyRepository>();
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new { partyLifecycleState = 999 })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);
        var savedParty = await repository.GetByIdAsync(partyId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), await response.Content.ReadAsStringAsync());
        Assert.That(savedParty?.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
    }

    [Test]
    public async Task AdminEndpoint_ValidAdministratorCredential_IsAccepted()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/admin/organizers");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), await response.Content.ReadAsStringAsync());
    }

    [Test]
    public async Task AdminPartyEndpoints_AppearInOpenApiDocument()
    {
        using var response = await _client.GetAsync("/swagger/v1/swagger.json");
        var body = await response.Content.ReadAsStringAsync();
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
        using var document = JsonDocument.Parse(body);
        var paths = document.RootElement.GetProperty("paths");

        Assert.That(paths.TryGetProperty("/api/admin/parties", out var listOperations), Is.True);
        Assert.That(listOperations.TryGetProperty("get", out _), Is.True);
        Assert.That(paths.TryGetProperty("/api/admin/parties/{id}/lifecycle", out var lifecycleOperations), Is.True);
        Assert.That(lifecycleOperations.TryGetProperty("patch", out _), Is.True);
        Assert.That(paths.TryGetProperty("/api/admin/parties/{id}/catalog-visibility", out var visibilityOperations), Is.True);
        Assert.That(visibilityOperations.TryGetProperty("patch", out _), Is.True);
    }

    [Test]
    public async Task AdminGrant_InMemoryStorage_IsVisibleToUserThemeAccess()
    {
        using var scope = _factory.Services.CreateScope();
        var organizerRepository = scope.ServiceProvider.GetRequiredService<IOrganizerRepository>();
        var sessionRepository = scope.ServiceProvider.GetRequiredService<IOrganizerSessionRepository>();
        var jwtService = scope.ServiceProvider.GetRequiredService<IJwtService>();
        var packages = scope.ServiceProvider.GetRequiredService<IThemePackageRepository>();
        var adminId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var adminSessionId = Guid.NewGuid();
        var organizerSessionId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var organizer = new Organizer
        {
            Id = organizerId,
            Name = "Entitlement recipient",
            Role = OrganizerRole.Organizer
        };
        await organizerRepository.AddAsync(new Organizer { Id = adminId, Name = "Entitlement admin", Role = OrganizerRole.Admin });
        await organizerRepository.AddAsync(organizer);
        await sessionRepository.AddAsync(new OrganizerSession { Id = adminSessionId, OrganizerId = adminId });
        await sessionRepository.AddAsync(new OrganizerSession { Id = organizerSessionId, OrganizerId = organizerId });
        await packages.UpsertAsync(new ThemePackage
        {
            Id = packageId,
            Code = $"admin-test-{packageId:N}",
            Name = "Admin test package",
            IsActive = true,
            IsAutoGranted = false,
            ThemeIds = ["cyberpunk"]
        });
        var adminToken = await jwtService.GenerateTokenAsync(adminId, "Entitlement admin", adminSessionId, "admin");
        var organizerToken = await jwtService.GenerateTokenAsync(organizerId, "Entitlement recipient", organizerSessionId, "organizer");
        using var grantRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/admin/organizers/{organizerId}/entitlements")
        {
            Content = JsonContent(new { packageId, note = "integration grant" })
        };
        grantRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);

        using var grantResponse = await _client.SendAsync(grantRequest);
        using var accessRequest = new HttpRequestMessage(HttpMethod.Get, "/api/organizer/me/theme-access");
        accessRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", organizerToken);
        using var accessResponse = await _client.SendAsync(accessRequest);
        var accessBody = await accessResponse.Content.ReadAsStringAsync();

        Assert.That(grantResponse.StatusCode, Is.EqualTo(HttpStatusCode.Created), await grantResponse.Content.ReadAsStringAsync());
        Assert.That(accessResponse.StatusCode, Is.EqualTo(HttpStatusCode.OK), accessBody);
        using var accessDocument = JsonDocument.Parse(accessBody);
        Assert.That(accessDocument.RootElement.GetProperty("grantedThemeIds").EnumerateArray()
            .Select(theme => theme.GetString()), Does.Contain("cyberpunk"));
    }

    [TestCase("draft")]
    [TestCase("ready")]
    [TestCase("completed")]
    public async Task AdminPartyLifecycle_AdminRequest_AcceptsTargetState(string targetState)
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new { partyLifecycleState = targetState })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), await response.Content.ReadAsStringAsync());
    }

    [Test]
    public async Task AdminPartyLifecycle_InvalidTargetState_IsRejectedWithoutMutation()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IPartyRepository>();
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new { partyLifecycleState = "not-a-state" })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);
        var saved = await repository.GetByIdAsync(partyId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), await response.Content.ReadAsStringAsync());
        Assert.That(saved?.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
        Assert.That(saved?.IsListedInCatalog, Is.True);
    }

    [Test]
    public async Task AdminPartyVisibility_AdminRequest_AcceptsCatalogFlag()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/catalog-visibility")
        {
            Content = JsonContent(new { isListedInCatalog = false })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), await response.Content.ReadAsStringAsync());
    }

    [TestCase("draft", "draft")]
    [TestCase("draft", "ready")]
    [TestCase("draft", "completed")]
    [TestCase("ready", "draft")]
    [TestCase("ready", "ready")]
    [TestCase("ready", "completed")]
    [TestCase("completed", "draft")]
    [TestCase("completed", "ready")]
    [TestCase("completed", "completed")]
    public async Task AdminPartyLifecycle_AllSourceAndTargetStatesPersist(string source, string target)
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(Enum.Parse<PartyLifecycleState>(source, true), true);
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new { partyLifecycleState = target })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);
        using var scope = _factory.Services.CreateScope();
        var savedParty = await scope.ServiceProvider.GetRequiredService<IPartyRepository>().GetByIdAsync(partyId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), await response.Content.ReadAsStringAsync());
        Assert.That(savedParty?.PartyLifecycleState, Is.EqualTo(Enum.Parse<PartyLifecycleState>(target, true)));
    }

    [TestCase(false, false, HttpStatusCode.OK)]
    [TestCase(false, true, HttpStatusCode.OK)]
    [TestCase(true, false, HttpStatusCode.OK)]
    [TestCase(true, true, HttpStatusCode.Conflict)]
    public async Task AdminPartyLifecycle_ActiveSessionAndConnectedDesktopCombinationControlsWrite(
        bool sessionActive,
        bool desktopConnected,
        HttpStatusCode expectedStatus)
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var scope = _factory.Services.CreateScope();
        if (sessionActive)
        {
            var streamingRepository = scope.ServiceProvider.GetRequiredService<IStreamingRepository>();
            await streamingRepository.SetSessionStateAsync(partyId, new PlaybackState
            {
                IsActive = true,
                Mode = PlaybackMode.Session
            });
        }
        if (desktopConnected)
        {
            scope.ServiceProvider.GetRequiredService<IOrganizerConnectionTracker>()
                .RegisterOrganizer($"admin-test-{partyId:N}", partyId);
        }
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new { partyLifecycleState = "draft" })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(expectedStatus), await response.Content.ReadAsStringAsync());
    }

    [Test]
    public async Task AdminPartyVisibility_RemainsAvailableDuringActiveConnectedSession()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var scope = _factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<IStreamingRepository>().SetSessionStateAsync(partyId, new PlaybackState
        {
            IsActive = true,
            Mode = PlaybackMode.Session
        });
        scope.ServiceProvider.GetRequiredService<IOrganizerConnectionTracker>()
            .RegisterOrganizer($"admin-test-{partyId:N}", partyId);
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/catalog-visibility")
        {
            Content = JsonContent(new { isListedInCatalog = false })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), await response.Content.ReadAsStringAsync());
    }

    [Test]
    public async Task AdminPartySearch_CombinesOrganizerNameCityAndLifecycleFilters()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var organizer = await CreatePartyOrganizerAsync();
        var matching = new Party
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            Name = $"Admin search {Guid.NewGuid():N}",
            ShortCode = $"A{Guid.NewGuid():N}"[..7],
            City = "Moscow",
            PartyLifecycleState = PartyLifecycleState.Draft
        };
        var nonMatching = new Party
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            Name = $"Admin search {Guid.NewGuid():N}",
            ShortCode = $"B{Guid.NewGuid():N}"[..7],
            City = "Kazan",
            PartyLifecycleState = PartyLifecycleState.Ready
        };
        using (var scope = _factory.Services.CreateScope())
        {
            var repository = scope.ServiceProvider.GetRequiredService<IPartyRepository>();
            await repository.AddAsync(matching);
            await repository.AddAsync(nonMatching);
        }
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.GetAsync($"/api/admin/parties?organizerId={organizer.Id}&query=Admin%20search&city=Moscow&partyLifecycleState=draft&page=1&pageSize=20");
        var body = await response.Content.ReadAsStringAsync();

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
        using var document = JsonDocument.Parse(body);
        var items = document.RootElement.GetProperty("items").EnumerateArray().ToArray();
        Assert.That(items, Has.Length.EqualTo(1));
        Assert.That(items[0].GetProperty("id").GetString(), Is.EqualTo(matching.Id.ToString()));
        Assert.That(document.RootElement.GetProperty("total").GetInt32(), Is.EqualTo(1));
    }

    [Test]
    public async Task AdminPartyLifecycle_OverpostedOwnerAndVisibilityFields_AreIgnored()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IPartyRepository>();
        var original = await repository.GetByIdAsync(partyId);
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new
            {
                partyLifecycleState = "completed",
                organizerId = Guid.NewGuid(),
                isListedInCatalog = false,
                name = "Injected name"
            })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);
        var updated = await repository.GetByIdAsync(partyId);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), await response.Content.ReadAsStringAsync());
        Assert.That(updated?.OrganizerId, Is.EqualTo(original?.OrganizerId));
        Assert.That(updated?.IsListedInCatalog, Is.True);
        Assert.That(updated?.Name, Is.EqualTo(original?.Name));
        Assert.That(updated?.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Completed));
    }

    [Test]
    public async Task AdminPartyLifecycle_NotifiesViewerSignalRClientAfterPersistingTransition()
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Admin);
        var partyId = await SeedPartyAsync(PartyLifecycleState.Ready, true);
        using var scope = _factory.Services.CreateScope();
        var party = await scope.ServiceProvider.GetRequiredService<IPartyRepository>().GetByIdAsync(partyId);
        var notification = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        await using var connection = new HubConnectionBuilder()
            .WithUrl("http://localhost/partyHub", options =>
            {
                options.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
                options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.LongPolling;
            })
            .Build();
        connection.On<string>("OnStateChanged", partyIdValue => notification.TrySetResult(partyIdValue));
        await connection.StartAsync();
        await connection.InvokeAsync("JoinPartyAsViewer", party!.ShortCode);
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new { partyLifecycleState = "completed" })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
        var notifiedPartyId = await notification.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.That(notifiedPartyId, Is.EqualTo(partyId.ToString()));
    }

    [TestCase(true)]
    [TestCase(false)]
    public async Task AdminPartyLifecycle_OrganizerCannotDiscoverOrChangeParty(bool existingParty)
    {
        var token = await CreateIdentityTokenAsync(OrganizerRole.Organizer);
        var partyId = existingParty
            ? await SeedPartyAsync(PartyLifecycleState.Ready, true)
            : Guid.NewGuid();
        using var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/admin/parties/{partyId}/lifecycle")
        {
            Content = JsonContent(new { partyLifecycleState = "draft" })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _client.SendAsync(request);
        Party? savedParty = null;
        if (existingParty)
        {
            using var scope = _factory.Services.CreateScope();
            savedParty = await scope.ServiceProvider.GetRequiredService<IPartyRepository>().GetByIdAsync(partyId);
        }

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden), await response.Content.ReadAsStringAsync());
        if (existingParty)
        {
            Assert.That(savedParty?.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
        }
    }

    private async Task<string> CreateIdentityTokenAsync(OrganizerRole role, string? tokenRole = null)
    {
        using var scope = _factory.Services.CreateScope();
        var organizerId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var organizerRepository = scope.ServiceProvider.GetRequiredService<IOrganizerRepository>();
        var sessionRepository = scope.ServiceProvider.GetRequiredService<IOrganizerSessionRepository>();
        var jwtService = scope.ServiceProvider.GetRequiredService<IJwtService>();
        await organizerRepository.AddAsync(new Organizer
        {
            Id = organizerId,
            Name = $"Admin security {role}",
            Role = role
        });
        await sessionRepository.AddAsync(new OrganizerSession
        {
            Id = sessionId,
            OrganizerId = organizerId
        });
        return await jwtService.GenerateTokenAsync(organizerId, "Admin security", sessionId, tokenRole ?? (role == OrganizerRole.Admin ? "admin" : "organizer"));
    }

    private async Task<Guid> SeedPartyAsync(PartyLifecycleState state, bool isListed)
    {
        var organizer = await CreatePartyOrganizerAsync();
        var party = new Party
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            Name = $"Admin party {Guid.NewGuid():N}",
            ShortCode = $"P{Guid.NewGuid():N}"[..7],
            City = "Moscow",
            PartyLifecycleState = state,
            IsListedInCatalog = isListed
        };
        using var scope = _factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<IPartyRepository>().AddAsync(party);
        return party.Id;
    }

    private async Task<Organizer> CreatePartyOrganizerAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var organizer = new Organizer
        {
            Id = Guid.NewGuid(),
            Name = $"Party owner {Guid.NewGuid():N}",
            Role = OrganizerRole.Organizer
        };
        return await scope.ServiceProvider.GetRequiredService<IOrganizerRepository>().AddAsync(organizer);
    }

    private static StringContent JsonContent<T>(T value) =>
        new(JsonSerializer.Serialize(value), Encoding.UTF8, "application/json");
}
