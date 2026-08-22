using CherryPlayServer.Controllers;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace CherryPlayServer.Tests;

public class DesktopAuthOAuthReturnControllerTests
{
    [Test]
    public async Task WebCallback_WithPublicWebBaseUrl_RedirectsToLoginWithCodeOnly()
    {
        var organizerId = Guid.NewGuid();
        var desktopCodes = new StubDesktopAuthCodeService();
        var controller = CreateController(
            organizerId,
            desktopCodes,
            new OAuthStateConsumeResult(AuthConstants.DesktopClientValue),
            configuration: BuildConfig(("PUBLIC_WEB_BASE_URL", "https://web.example")));

        var action = await controller.WebCallback("vk", "oauth-code", "state");

        Assert.That(action, Is.TypeOf<RedirectResult>());
        var redirect = (RedirectResult)action;
        Assert.That(
            redirect.Url,
            Is.EqualTo("https://web.example/login?client=desktop&code=issued-code"));
        Assert.That(controller.Response.Headers.SetCookie.Count, Is.EqualTo(0));
    }

    [Test]
    public async Task WebCallback_WithAllowedReturnTo_IncludesReturnToOnWebLogin()
    {
        var returnTo = "http://localhost:5173/auth/callback";
        var desktopCodes = new StubDesktopAuthCodeService();
        var controller = CreateController(
            Guid.NewGuid(),
            desktopCodes,
            new OAuthStateConsumeResult(AuthConstants.DesktopClientValue, returnTo),
            configuration: BuildConfig(("PUBLIC_WEB_BASE_URL", "http://localhost:3000")));

        var action = await controller.WebCallback("mailru", "oauth-code", "state");

        Assert.That(action, Is.TypeOf<RedirectResult>());
        var redirect = (RedirectResult)action;
        Assert.That(
            redirect.Url,
            Is.EqualTo(
                "http://localhost:3000/login?client=desktop&code=issued-code&return_to=" +
                Uri.EscapeDataString(returnTo)));
    }

    [Test]
    public async Task WebCallback_WithDisallowedReturnTo_OmitsReturnToAndUsesDeepLinkInHtmlFallback()
    {
        var desktopCodes = new StubDesktopAuthCodeService();
        var controller = CreateController(
            Guid.NewGuid(),
            desktopCodes,
            new OAuthStateConsumeResult(AuthConstants.DesktopClientValue, "https://evil.example/steal"));

        var action = await controller.WebCallback("vk", "oauth-code", "state");

        Assert.That(action, Is.TypeOf<ContentResult>());
        var content = (ContentResult)action;
        Assert.That(content.Content, Does.Contain($"{AuthConstants.DesktopAuthDeepLinkBase}?code=issued-code"));
        Assert.That(content.Content, Does.Not.Contain("evil.example"));
        Assert.That(content.Content, Does.Not.Contain("accessToken"));
        Assert.That(content.Content, Does.Not.Contain("jwt"));
    }

    [Test]
    public async Task WebCallback_WithoutPublicWebBase_ReturnsHtmlWithAllowedHttpReturnTo()
    {
        var returnTo = "http://127.0.0.1:5174/auth/callback";
        var desktopCodes = new StubDesktopAuthCodeService();
        var controller = CreateController(
            Guid.NewGuid(),
            desktopCodes,
            new OAuthStateConsumeResult(AuthConstants.DesktopClientValue, returnTo));

        var action = await controller.WebCallback("vk", "oauth-code", "state");

        Assert.That(action, Is.TypeOf<ContentResult>());
        var content = (ContentResult)action;
        Assert.That(content.ContentType, Does.StartWith("text/html"));
        Assert.That(content.Content, Does.Contain($"{returnTo}?code=issued-code"));
        Assert.That(content.Content, Does.Contain("нажмите здесь"));
    }

    [Test]
    public async Task WebCallback_NonDesktopState_SetsCookieAndRedirectsCabinet()
    {
        var desktopCodes = new StubDesktopAuthCodeService();
        var controller = CreateController(
            Guid.NewGuid(),
            desktopCodes,
            new OAuthStateConsumeResult(null));

        var action = await controller.WebCallback("vk", "oauth-code", "state");

        Assert.That(action, Is.TypeOf<RedirectResult>());
        Assert.That(((RedirectResult)action).Url, Is.EqualTo("/cabinet"));
        Assert.That(desktopCodes.IssueCount, Is.EqualTo(0));
        Assert.That(controller.Response.Headers.SetCookie.Count, Is.GreaterThan(0));
    }

    [Test]
    public async Task ExchangeDesktopCode_EmptyCode_Returns400()
    {
        var controller = AuthControllerTestFactory.Create(
            new StubAuthService(Guid.NewGuid()),
            desktopAuthCodeService: new StubDesktopAuthCodeService());

        var action = await controller.ExchangeDesktopCode(new DesktopAuthExchangeRequest("  "));

        Assert.That(action.Result, Is.TypeOf<BadRequestObjectResult>());
    }

    [Test]
    public async Task StartWebAuth_PersistsDesktopClientAndReturnToInState()
    {
        var recordingState = new RecordingOAuthStateService();
        var controller = AuthControllerTestFactory.Create(
            new StubAuthService(Guid.NewGuid()),
            oauthStateService: recordingState,
            configureHttpContext: ctx =>
            {
                ctx.Request.Scheme = "https";
                ctx.Request.Host = new HostString("api.example");
            });

        var action = await controller.StartWebAuth(
            "vk",
            client: AuthConstants.DesktopClientValue,
            return_to: "http://localhost:5173/auth/callback");

        Assert.That(action, Is.TypeOf<RedirectResult>());
        Assert.That(recordingState.LastClient, Is.EqualTo(AuthConstants.DesktopClientValue));
        Assert.That(recordingState.LastReturnTo, Is.EqualTo("http://localhost:5173/auth/callback"));
    }

    [Test]
    public async Task StartWebAuth_RejectsDisallowedReturnTo()
    {
        var recordingState = new RecordingOAuthStateService();
        var controller = AuthControllerTestFactory.Create(
            new StubAuthService(Guid.NewGuid()),
            oauthStateService: recordingState,
            configureHttpContext: ctx =>
            {
                ctx.Request.Scheme = "https";
                ctx.Request.Host = new HostString("api.example");
            });

        var action = await controller.StartWebAuth(
            "vk",
            client: AuthConstants.DesktopClientValue,
            return_to: "https://phishing.example/callback");

        Assert.That(action, Is.TypeOf<RedirectResult>());
        Assert.That(recordingState.LastClient, Is.EqualTo(AuthConstants.DesktopClientValue));
        Assert.That(recordingState.LastReturnTo, Is.Null);
    }

    private static AuthController CreateController(
        Guid organizerId,
        StubDesktopAuthCodeService desktopCodes,
        OAuthStateConsumeResult consumeResult,
        IConfiguration? configuration = null)
    {
        return AuthControllerTestFactory.Create(
            new StubAuthService(organizerId),
            desktopAuthCodeService: desktopCodes,
            oauthStateService: new ConfigurableOAuthStateService { ConsumeResult = consumeResult },
            configuration: configuration,
            configureHttpContext: ctx =>
            {
                ctx.Request.Scheme = "https";
                ctx.Request.Host = new HostString("localhost");
            });
    }

    private static IConfiguration BuildConfig(params (string Key, string Value)[] pairs)
    {
        var dict = pairs.ToDictionary(p => p.Key, p => p.Value);
        return new ConfigurationBuilder().AddInMemoryCollection(dict!).Build();
    }

    private sealed class StubAuthService(Guid organizerId) : IAuthService
    {
        public Task<AuthResult> LoginAsync(string email, string password, bool issueToken = true) =>
            throw new NotSupportedException();

        public Task<AuthResult> RegisterAsync(string email, string password, string name, bool issueToken = true) =>
            throw new NotSupportedException();

        public Task<string> GenerateTokenAsync(Organizer organizer) => Task.FromResult("jwt");

        public Task<Organizer> ProcessOAuthCallbackAsync(
            OAuthProvider provider,
            string code,
            string redirectUri,
            string? deviceId = null) =>
            Task.FromResult(new Organizer { Id = organizerId, Name = "OAuth", CreatedAt = DateTime.UtcNow });

        public Task<ForgotPasswordResult> ForgotPasswordAsync(string email) =>
            throw new NotSupportedException();

        public Task<PasswordMutationResult> ResetPasswordAsync(string token, string newPassword) =>
            throw new NotSupportedException();

        public Task<PasswordMutationResult> ChangePasswordAsync(
            Guid organizerId,
            string oldPassword,
            string newPassword) =>
            throw new NotSupportedException();
    }

    private sealed class StubDesktopAuthCodeService : IDesktopAuthCodeService
    {
        public int IssueCount { get; private set; }

        public Task<string> IssueCodeAsync(Guid organizerId)
        {
            IssueCount++;
            return Task.FromResult("issued-code");
        }

        public Task<string?> ExchangeAsync(string rawCode) => Task.FromResult<string?>(null);
    }

    private sealed class RecordingOAuthStateService : IOAuthStateService
    {
        public string? LastClient { get; private set; }
        public string? LastReturnTo { get; private set; }

        public string GenerateAndStoreState(string provider, string? client = null, string? returnTo = null)
        {
            LastClient = client;
            LastReturnTo = returnTo;
            return "state";
        }

        public bool ValidateAndConsumeState(string? state, string expectedProvider) => true;
    }
}
