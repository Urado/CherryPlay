using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Net.Http.Headers;

namespace CherryPlayServer.Tests;

[TestFixture]
[Category("ContainerIntegration")]
[NonParallelizable]
public sealed class ContainerLoginIntegrationTests
{
    private const string Password = "login-old-password-123";
    private const string NewPassword = "login-new-password-123";
    private ContainerIntegrationDatabase _database = null!;
    private ContainerLoginWebApplicationFactory _factory = null!;
    private HttpClient _client = null!;
    private string _email = string.Empty;
    private Guid _organizerId;
    private Guid _partyId;

    [SetUp]
    public async Task SetUp()
    {
        _database = await ContainerIntegrationDatabase.CreateAsync();
        _factory = new ContainerLoginWebApplicationFactory(_database.ConnectionString);
        _client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            HandleCookies = false,
            AllowAutoRedirect = false
        });
        _client.Timeout = TimeSpan.FromSeconds(15);
        _email = $"login-{Guid.NewGuid():N}@example.test";
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var versions = await db.LegalDocumentVersions.AsNoTracking().Where(version => version.Status == "active").ToListAsync();
        using var registration = await _client.PostAsJsonAsync("/api/organizers", new
        {
            email = _email,
            password = Password,
            name = "Login integration organizer",
            consents = versions.Select(version => new
            {
                id = Guid.NewGuid(), legalDocumentVersionId = version.Id, documentHash = version.ContentHash, decision = "grant"
            }).ToArray()
        });
        Assert.That(registration.StatusCode, Is.EqualTo(HttpStatusCode.Created), await registration.Content.ReadAsStringAsync());
        using var result = JsonDocument.Parse(await registration.Content.ReadAsStringAsync());
        _organizerId = result.RootElement.GetProperty("id").GetGuid();
        _partyId = Guid.NewGuid();
        await scope.ServiceProvider.GetRequiredService<IPartyRepository>().AddAsync(new Party
        {
            Id = _partyId, OrganizerId = _organizerId, Name = "Login streaming",
            ShortCode = $"login{Guid.NewGuid():N}"[..10], PartyLifecycleState = PartyLifecycleState.Ready
        });
        Assert.That(await SessionCountAsync(), Is.Zero);
    }

    [TearDown]
    public async Task TearDown()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
        if (_database is not null)
        {
            await _database.DisposeAsync();
        }
    }

    [Test]
    public async Task AUTH01_WebCookieLoginAuthorizesProfileAndLogoutRevokesReplayedCookie()
    {
        var login = await LoginAsync(Password);
        var cookie = SetCookieHeaderValue.Parse(login.SetCookie);
        Assert.That(cookie.Name.ToString(), Is.EqualTo(AuthConstants.AuthCookieName));
        Assert.That(cookie.HttpOnly, Is.True);
        Assert.That(cookie.Secure, Is.True);
        Assert.That(cookie.SameSite, Is.EqualTo(Microsoft.Net.Http.Headers.SameSiteMode.None));
        Assert.That(cookie.Path.ToString(), Is.EqualTo("/"));
        Assert.That(cookie.Expires, Is.InRange(
            DateTimeOffset.UtcNow.AddDays(AuthConstants.TokenLifetimeDays).AddMinutes(-1),
            DateTimeOffset.UtcNow.AddDays(AuthConstants.TokenLifetimeDays).AddMinutes(1)));
        Assert.That(await SessionCountAsync(), Is.EqualTo(1));
        using var profileRequest = CookieRequest(HttpMethod.Get, "/api/organizer/me", login.Cookie);
        Assert.That(profileRequest.Headers.Authorization, Is.Null);
        using var profile = await _client.SendAsync(profileRequest);
        Assert.That(profile.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        using var body = JsonDocument.Parse(await profile.Content.ReadAsStringAsync());
        Assert.That(body.RootElement.GetProperty("id").GetGuid(), Is.EqualTo(_organizerId));
        using var logoutRequest = CookieRequest(HttpMethod.Post, "/auth/logout", login.Cookie);
        using var logout = await _client.SendAsync(logoutRequest);
        Assert.That(logout.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        var deletedCookie = SetCookieHeaderValue.Parse(logout.Headers.GetValues("Set-Cookie").Single());
        Assert.That(deletedCookie.Value.ToString(), Is.Empty);
        Assert.That(deletedCookie.Expires, Is.LessThan(DateTimeOffset.UtcNow));
        using var replayRequest = CookieRequest(HttpMethod.Get, "/api/organizer/me", login.Cookie);
        using var replay = await _client.SendAsync(replayRequest);
        Assert.That(replay.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(await SessionCountAsync(), Is.Zero);
    }

    [Test]
    public async Task AUTH02_WrongPasswordAndUnknownEmailHaveSameFailureWithoutCredentialsOrSessions()
    {
        using var wrong = await _client.PostAsJsonAsync("/auth/login", new { email = _email, password = "incorrect-password" });
        using var unknown = await _client.PostAsJsonAsync("/auth/login", new { email = "unknown@example.test", password = Password });
        await AssertFailedLoginAsync(wrong);
        await AssertFailedLoginAsync(unknown);
        Assert.That(await wrong.Content.ReadAsStringAsync(), Is.EqualTo(await unknown.Content.ReadAsStringAsync()));
        Assert.That(await SessionCountAsync(), Is.Zero);
    }

    [TestCase("reset")]
    [TestCase("change")]
    public async Task AUTH03_PasswordMutationRequiresNewPasswordAndNewJwtForRestAndSignalR(string mutation)
    {
        var oldLogin = await LoginAsync(Password);
        await AssertJwtAccessAsync(oldLogin.Token);
        using var request = mutation == "reset"
            ? new HttpRequestMessage(HttpMethod.Post, "/auth/reset-password")
            {
                Content = JsonContent.Create(new { token = await CreateResetTokenAsync(), newPassword = NewPassword })
            }
            : BearerRequest(HttpMethod.Post, "/auth/change-password", oldLogin.Token,
                JsonContent.Create(new { oldPassword = Password, newPassword = NewPassword }));
        using var response = await _client.SendAsync(request);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), await response.Content.ReadAsStringAsync());
        Assert.That(await SessionCountAsync(), Is.Zero);
        using var oldPasswordLogin = await _client.PostAsJsonAsync("/auth/login", new { email = _email, password = Password });
        await AssertFailedLoginAsync(oldPasswordLogin);
        var newLogin = await LoginAsync(NewPassword);
        Assert.That(newLogin.Token, Is.Not.EqualTo(oldLogin.Token));
        Assert.That(await SessionCountAsync(), Is.EqualTo(1));
        await AssertJwtAccessAsync(newLogin.Token);
        await AssertJwtDeniedAsync(oldLogin.Token);
        using var oldCookieRequest = CookieRequest(HttpMethod.Get, "/api/organizer/me", oldLogin.Cookie);
        using var oldCookieResponse = await _client.SendAsync(oldCookieRequest);
        Assert.That(oldCookieResponse.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task AUTH04_DesktopLoginCodeExchangeAuthorizesRestAndSignalRAndRejectsReplay()
    {
        using var login = await _client.PostAsJsonAsync("/auth/login?client=desktop", new { email = _email, password = Password });
        Assert.That(login.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(login.Headers.Contains("Set-Cookie"), Is.True);
        var browserToken = SetCookieHeaderValue.Parse(login.Headers.GetValues("Set-Cookie").Single()).Value.ToString();
        Assert.That(await SessionCountAsync(), Is.EqualTo(1));
        using var body = JsonDocument.Parse(await login.Content.ReadAsStringAsync());
        Assert.That(body.RootElement.TryGetProperty("accessToken", out _), Is.False);
        var code = body.RootElement.GetProperty("code").GetString();
        Assert.That(code, Is.Not.Null.And.Not.Empty);
        var token = await ExchangeAsync(code ?? throw new InvalidOperationException("Missing desktop code"));
        Assert.That(token, Is.Not.EqualTo(browserToken));
        Assert.That(await SessionCountAsync(), Is.EqualTo(2));
        await AssertJwtAccessAsync(token);
        var before = await SessionCountAsync();
        using var replay = await _client.PostAsJsonAsync("/auth/desktop/exchange", new { code });
        Assert.That(replay.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(replay.Headers.Contains("Set-Cookie"), Is.False);
        Assert.That(await replay.Content.ReadAsStringAsync(), Does.Not.Contain("accessToken"));
        Assert.That(await SessionCountAsync(), Is.EqualTo(before));
    }

    [Test]
    public async Task AUTH05_WebCookieIssuesDesktopCodeAndLogoutPreventsStaleCookieCodeIssue()
    {
        var login = await LoginAsync(Password);
        using var codeRequest = CookieRequest(HttpMethod.Post, "/auth/desktop/code", login.Cookie);
        Assert.That(codeRequest.Headers.Authorization, Is.Null);
        using var response = await _client.SendAsync(codeRequest);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var code = result.RootElement.GetProperty("code").GetString() ?? throw new InvalidOperationException("Missing desktop code");
        var desktopToken = await ExchangeAsync(code);
        Assert.That(desktopToken, Is.Not.EqualTo(login.Token));
        Assert.That(await SessionCountAsync(), Is.EqualTo(2));
        await AssertJwtAccessAsync(desktopToken);
        using var logoutRequest = CookieRequest(HttpMethod.Post, "/auth/logout", login.Cookie);
        using var logout = await _client.SendAsync(logoutRequest);
        Assert.That(logout.StatusCode, Is.EqualTo(HttpStatusCode.NoContent));
        Assert.That(await SessionCountAsync(), Is.EqualTo(1));
        var before = await SessionCountAsync();
        using var staleRequest = CookieRequest(HttpMethod.Post, "/auth/desktop/code", login.Cookie);
        using var stale = await _client.SendAsync(staleRequest);
        Assert.That(stale.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(stale.Headers.Contains("Set-Cookie"), Is.False);
        Assert.That(await stale.Content.ReadAsStringAsync(), Does.Not.Contain("code"));
        Assert.That(await SessionCountAsync(), Is.EqualTo(before));
        await AssertJwtAccessAsync(desktopToken);
    }

    [Test]
    public async Task AUTH06_FailedLoginsReachProductionRateLimitWithoutIssuingSessions()
    {
        var elapsed = Stopwatch.StartNew();
        for (var attempt = 0; attempt < AuthConstants.AuthRateLimitPermits; attempt++)
        {
            using var failure = await _client.PostAsJsonAsync("/auth/login", new { email = _email, password = "incorrect-password" });
            await AssertFailedLoginAsync(failure);
        }
        Assert.That(elapsed.Elapsed, Is.LessThan(AuthConstants.RateLimitWindow));
        using var limited = await _client.PostAsJsonAsync("/auth/login", new { email = _email, password = "incorrect-password" });
        Assert.That(limited.StatusCode, Is.EqualTo(HttpStatusCode.TooManyRequests));
        Assert.That(await limited.Content.ReadAsStringAsync(), Is.EqualTo("Too many requests. Try again later."));
        Assert.That(limited.Headers.Contains("Set-Cookie"), Is.False);
        using var validButLimited = await _client.PostAsJsonAsync("/auth/login", new { email = _email, password = Password });
        Assert.That(validButLimited.StatusCode, Is.EqualTo(HttpStatusCode.TooManyRequests));
        Assert.That(validButLimited.Headers.Contains("Set-Cookie"), Is.False);
        Assert.That(await validButLimited.Content.ReadAsStringAsync(), Does.Not.Contain("accessToken"));
        Assert.That(await SessionCountAsync(), Is.Zero);
    }

    private async Task<(string Token, string Cookie, string SetCookie)> LoginAsync(string password)
    {
        using var response = await _client.PostAsJsonAsync("/auth/login", new { email = _email, password });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), await response.Content.ReadAsStringAsync());
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var token = body.RootElement.GetProperty("accessToken").GetString() ?? throw new InvalidOperationException("Missing login token");
        Assert.That(token, Is.Not.Empty);
        var setCookie = response.Headers.GetValues("Set-Cookie").Single();
        var parsed = SetCookieHeaderValue.Parse(setCookie);
        return (token, $"{parsed.Name}={parsed.Value}", setCookie);
    }

    private async Task<string> ExchangeAsync(string code)
    {
        using var response = await _client.PostAsJsonAsync("/auth/desktop/exchange", new { code });
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), await response.Content.ReadAsStringAsync());
        using var result = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var token = result.RootElement.GetProperty("accessToken").GetString() ?? throw new InvalidOperationException("Missing desktop token");
        Assert.That(token, Is.Not.Empty);
        return token;
    }

    private async Task AssertJwtAccessAsync(string token)
    {
        using var request = BearerRequest(HttpMethod.Get, "/api/organizer/me", token);
        using var response = await _client.SendAsync(request);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        using var profile = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.That(profile.RootElement.GetProperty("id").GetGuid(), Is.EqualTo(_organizerId));
        await using var connection = CreateHubConnection(token);
        using var events = new ContainerSignalRSessionEventProbe(connection);
        await connection.StartAsync().WaitAsync(TimeSpan.FromSeconds(10));
        await connection.InvokeAsync("JoinPartyAsOrganizer", _partyId.ToString(), token).WaitAsync(TimeSpan.FromSeconds(10));
        await events.WaitForEventAsync("OnPartyDisplayStatusChanged");
        await connection.InvokeAsync("StartSession", _partyId.ToString()).WaitAsync(TimeSpan.FromSeconds(10));
        Assert.That((await events.WaitForEventAsync("OnSessionStarted"))[0], Is.EqualTo(_partyId.ToString()));
        Assert.That(events.Errors, Is.Empty);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.That(await db.SessionStates.AsNoTracking().AnyAsync(state => state.PartyId == _partyId && state.IsActive), Is.True);
    }

    private async Task AssertJwtDeniedAsync(string token)
    {
        using var request = BearerRequest(HttpMethod.Get, "/api/organizer/me", token);
        using var response = await _client.SendAsync(request);
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var before = JsonSerializer.Serialize(await db.SessionStates.AsNoTracking().SingleAsync(state => state.PartyId == _partyId));
        await using var connection = CreateHubConnection(token);
        using var events = new ContainerSignalRSessionEventProbe(connection);
        await connection.StartAsync().WaitAsync(TimeSpan.FromSeconds(10));
        await connection.InvokeAsync("EndSession", _partyId.ToString()).WaitAsync(TimeSpan.FromSeconds(10));
        Assert.That(await events.WaitForErrorAsync(), Is.EqualTo("Authentication required"));
        Assert.That(JsonSerializer.Serialize(await db.SessionStates.AsNoTracking().SingleAsync(state => state.PartyId == _partyId)), Is.EqualTo(before));
    }

    private HubConnection CreateHubConnection(string token) => new HubConnectionBuilder()
        .WithUrl(new Uri(_client.BaseAddress!, "partyHub"), options =>
        {
            options.Transports = HttpTransportType.LongPolling;
            options.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
            options.AccessTokenProvider = () => Task.FromResult<string?>(token);
        }).Build();

    private async Task<int> SessionCountAsync()
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<AppDbContext>().OrganizerSessions.CountAsync();
    }

    private async Task<string> CreateResetTokenAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var account = await db.EmailAccounts.SingleAsync(account => account.OrganizerId == _organizerId);
        var token = PasswordResetTokenHelper.GenerateRawToken();
        db.PasswordResetTokens.Add(new PasswordResetTokenEf
        {
            Id = Guid.NewGuid(), EmailAccountId = account.Id, TokenHash = PasswordResetTokenHelper.HashToken(token),
            CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.Add(AuthConstants.PasswordResetTokenTtl)
        });
        await db.SaveChangesAsync();
        return token;
    }

    private static async Task AssertFailedLoginAsync(HttpResponseMessage response)
    {
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
        Assert.That(response.Headers.Contains("Set-Cookie"), Is.False);
        var body = await response.Content.ReadAsStringAsync();
        Assert.That(body, Does.Contain(AuthConstants.InvalidCredentialsMessage));
        Assert.That(body, Does.Not.Contain("accessToken").And.Not.Contain("code"));
    }

    private static HttpRequestMessage CookieRequest(HttpMethod method, string path, string cookie)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("Cookie", cookie);
        return request;
    }

    private static HttpRequestMessage BearerRequest(HttpMethod method, string path, string token, HttpContent? content = null)
    {
        var request = new HttpRequestMessage(method, path) { Content = content };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }
}
