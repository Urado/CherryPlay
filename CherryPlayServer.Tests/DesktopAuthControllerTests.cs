using CherryPlayServer.Controllers;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CherryPlayServer.Tests;

public class DesktopAuthControllerTests
{
    [Test]
    public async Task Login_WithDesktopHeader_ReturnsCodeOnlyWithoutCookie()
    {
        var organizerId = Guid.NewGuid();
        var auth = new DesktopFlowStubAuthService(organizerId);
        var desktopCodes = new RecordingDesktopAuthCodeService();
        var controller = AuthControllerTestFactory.Create(
            auth,
            desktopAuthCodeService: desktopCodes,
            configureHttpContext: ctx =>
            {
                ctx.Request.Headers[AuthConstants.DesktopClientHeaderName] = AuthConstants.DesktopClientValue;
            });

        var action = await controller.Login(new LoginRequest("user@example.com", "secret1"));

        Assert.That(action, Is.TypeOf<OkObjectResult>());
        var body = (DesktopAuthCodeResponse)((OkObjectResult)action).Value!;
        Assert.That(body.Code, Is.EqualTo("desktop-code"));
        Assert.That(auth.LastLoginIssueToken, Is.False);
        Assert.That(desktopCodes.LastOrganizerId, Is.EqualTo(organizerId));
        Assert.That(controller.Response.Headers.SetCookie.Count, Is.EqualTo(0));
    }

    [Test]
    public async Task Login_WithDesktopQueryParam_ReturnsCodeOnlyWithoutCookie()
    {
        var organizerId = Guid.NewGuid();
        var auth = new DesktopFlowStubAuthService(organizerId);
        var desktopCodes = new RecordingDesktopAuthCodeService();
        var controller = AuthControllerTestFactory.Create(
            auth,
            desktopAuthCodeService: desktopCodes,
            configureHttpContext: ctx =>
            {
                ctx.Request.QueryString = new QueryString("?client=desktop");
            });

        var action = await controller.Login(new LoginRequest("user@example.com", "secret1"));

        Assert.That(action, Is.TypeOf<OkObjectResult>());
        var body = (DesktopAuthCodeResponse)((OkObjectResult)action).Value!;
        Assert.That(body.Code, Is.EqualTo("desktop-code"));
        Assert.That(auth.LastLoginIssueToken, Is.False);
        Assert.That(controller.Response.Headers.SetCookie.Count, Is.EqualTo(0));
    }

    [Test]
    public async Task Register_WithDesktopHeader_ReturnsCodeOnlyWithoutCookie()
    {
        var organizerId = Guid.NewGuid();
        var auth = new DesktopFlowStubAuthService(organizerId);
        var desktopCodes = new RecordingDesktopAuthCodeService();
        var controller = AuthControllerTestFactory.Create(
            auth,
            desktopAuthCodeService: desktopCodes,
            configureHttpContext: ctx =>
            {
                ctx.Request.Headers[AuthConstants.DesktopClientHeaderName] = AuthConstants.DesktopClientValue;
            });

        var action = await controller.Register(new RegisterRequest("user@example.com", "secret1", "User"));

        Assert.That(action, Is.TypeOf<OkObjectResult>());
        var body = (DesktopAuthCodeResponse)((OkObjectResult)action).Value!;
        Assert.That(body.Code, Is.EqualTo("desktop-code"));
        Assert.That(auth.LastRegisterIssueToken, Is.False);
        Assert.That(desktopCodes.LastOrganizerId, Is.EqualTo(organizerId));
        Assert.That(controller.Response.Headers.SetCookie.Count, Is.EqualTo(0));
    }

    [Test]
    public async Task Login_WithoutDesktopClient_SetsCookieAndOmitsCode()
    {
        var organizerId = Guid.NewGuid();
        var auth = new DesktopFlowStubAuthService(organizerId);
        var desktopCodes = new RecordingDesktopAuthCodeService();
        var controller = AuthControllerTestFactory.Create(auth, desktopAuthCodeService: desktopCodes);

        var action = await controller.Login(new LoginRequest("user@example.com", "secret1"));

        Assert.That(action, Is.TypeOf<OkObjectResult>());
        var body = (AuthExchangeResponse)((OkObjectResult)action).Value!;
        Assert.That(body.AccessToken, Is.EqualTo("jwt"));
        Assert.That(auth.LastLoginIssueToken, Is.True);
        Assert.That(desktopCodes.IssueCount, Is.EqualTo(0));
        Assert.That(controller.Response.Headers.SetCookie.Count, Is.GreaterThan(0));
    }

    [Test]
    public async Task WebCallback_WithDesktopState_ReturnsHtmlReturnPageWithoutCookie()
    {
        var organizerId = Guid.NewGuid();
        var auth = new DesktopFlowStubAuthService(organizerId);
        var desktopCodes = new RecordingDesktopAuthCodeService();
        var oauthState = new ConfigurableOAuthStateService
        {
            ConsumeResult = new OAuthStateConsumeResult(AuthConstants.DesktopClientValue),
        };
        var controller = AuthControllerTestFactory.Create(
            auth,
            desktopAuthCodeService: desktopCodes,
            oauthStateService: oauthState,
            configureHttpContext: ctx =>
            {
                ctx.Request.Scheme = "https";
                ctx.Request.Host = new HostString("localhost");
            });

        var action = await controller.WebCallback("vk", "oauth-code", "state");

        Assert.That(action, Is.TypeOf<ContentResult>());
        var content = (ContentResult)action;
        Assert.That(content.ContentType, Does.StartWith("text/html"));
        Assert.That(content.Content, Does.Contain($"{AuthConstants.DesktopAuthDeepLinkBase}?code=desktop-code"));
        Assert.That(content.Content, Does.Contain("Возвращаемся в приложение"));
        Assert.That(desktopCodes.LastOrganizerId, Is.EqualTo(organizerId));
        Assert.That(controller.Response.Headers.SetCookie.Count, Is.EqualTo(0));
    }

    [Test]
    public async Task ExchangeDesktopCode_InvalidCode_Returns401()
    {
        var auth = new DesktopFlowStubAuthService(Guid.NewGuid());
        var desktopCodes = new RecordingDesktopAuthCodeService { ExchangeResult = null };
        var controller = AuthControllerTestFactory.Create(auth, desktopAuthCodeService: desktopCodes);

        var action = await controller.ExchangeDesktopCode(new DesktopAuthExchangeRequest("bad"));

        Assert.That(action.Result, Is.TypeOf<UnauthorizedObjectResult>());
        var unauthorized = (UnauthorizedObjectResult)action.Result!;
        Assert.That(unauthorized.Value, Is.EqualTo(AuthConstants.DesktopAuthCodeInvalidMessage));
    }

    [Test]
    public async Task ExchangeDesktopCode_ValidCode_ReturnsAccessToken()
    {
        var auth = new DesktopFlowStubAuthService(Guid.NewGuid());
        var desktopCodes = new RecordingDesktopAuthCodeService { ExchangeResult = "exchanged-jwt" };
        var controller = AuthControllerTestFactory.Create(auth, desktopAuthCodeService: desktopCodes);

        var action = await controller.ExchangeDesktopCode(new DesktopAuthExchangeRequest("good-code"));

        Assert.That(action.Result, Is.TypeOf<OkObjectResult>());
        var body = (AuthExchangeResponse)((OkObjectResult)action.Result!).Value!;
        Assert.That(body.AccessToken, Is.EqualTo("exchanged-jwt"));
        Assert.That(desktopCodes.LastExchangeCode, Is.EqualTo("good-code"));
    }

    private sealed class DesktopFlowStubAuthService(Guid organizerId) : IAuthService
    {
        public bool? LastLoginIssueToken { get; private set; }
        public bool? LastRegisterIssueToken { get; private set; }

        public Task<AuthResult> LoginAsync(string email, string password, bool issueToken = true)
        {
            LastLoginIssueToken = issueToken;
            return Task.FromResult(new AuthResult(
                true,
                issueToken ? "jwt" : null,
                new Organizer { Id = organizerId, Name = "User", CreatedAt = DateTime.UtcNow },
                null));
        }

        public Task<AuthResult> RegisterAsync(string email, string password, string name, bool issueToken = true)
        {
            LastRegisterIssueToken = issueToken;
            return LoginAsync(email, password, issueToken);
        }

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

    private sealed class RecordingDesktopAuthCodeService : IDesktopAuthCodeService
    {
        public int IssueCount { get; private set; }
        public Guid? LastOrganizerId { get; private set; }
        public string? LastExchangeCode { get; private set; }
        public string? ExchangeResult { get; set; } = "exchanged-jwt";

        public Task<string> IssueCodeAsync(Guid organizerId)
        {
            IssueCount++;
            LastOrganizerId = organizerId;
            return Task.FromResult("desktop-code");
        }

        public Task<string?> ExchangeAsync(string rawCode)
        {
            LastExchangeCode = rawCode;
            return Task.FromResult(ExchangeResult);
        }
    }
}
