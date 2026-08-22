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

public class DesktopAuthRegisterQueryTests
{
    [Test]
    public async Task Register_WithDesktopQueryParam_ReturnsCodeOnlyWithoutCookie()
    {
        var organizerId = Guid.NewGuid();
        var auth = new RegisterFlowStubAuthService(organizerId);
        var desktopCodes = new RecordingDesktopAuthCodeService();
        var controller = AuthControllerTestFactory.Create(
            auth,
            desktopAuthCodeService: desktopCodes,
            configureHttpContext: ctx =>
            {
                ctx.Request.QueryString = new QueryString("?client=desktop");
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
    public async Task Register_WithoutDesktopClient_SetsCookieAndOmitsCode()
    {
        var organizerId = Guid.NewGuid();
        var auth = new RegisterFlowStubAuthService(organizerId);
        var desktopCodes = new RecordingDesktopAuthCodeService();
        var controller = AuthControllerTestFactory.Create(auth, desktopAuthCodeService: desktopCodes);

        var action = await controller.Register(new RegisterRequest("user@example.com", "secret1", "User"));

        Assert.That(action, Is.TypeOf<OkObjectResult>());
        var body = (AuthExchangeResponse)((OkObjectResult)action).Value!;
        Assert.That(body.AccessToken, Is.EqualTo("jwt"));
        Assert.That(auth.LastRegisterIssueToken, Is.True);
        Assert.That(desktopCodes.IssueCount, Is.EqualTo(0));
        Assert.That(controller.Response.Headers.SetCookie.Count, Is.GreaterThan(0));
    }

    [Test]
    public async Task ExchangeDesktopCode_NullBody_Returns400()
    {
        var controller = AuthControllerTestFactory.Create(
            new RegisterFlowStubAuthService(Guid.NewGuid()),
            desktopAuthCodeService: new RecordingDesktopAuthCodeService());

        var action = await controller.ExchangeDesktopCode(null!);

        Assert.That(action.Result, Is.TypeOf<BadRequestObjectResult>());
        var badRequest = (BadRequestObjectResult)action.Result!;
        Assert.That(badRequest.Value, Is.EqualTo("Code is required"));
    }

    private sealed class RegisterFlowStubAuthService(Guid organizerId) : IAuthService
    {
        public bool? LastRegisterIssueToken { get; private set; }

        public Task<AuthResult> RegisterAsync(string email, string password, string name, bool issueToken = true)
        {
            LastRegisterIssueToken = issueToken;
            return Task.FromResult(new AuthResult(
                true,
                issueToken ? "jwt" : null,
                new Organizer { Id = organizerId, Name = name, CreatedAt = DateTime.UtcNow },
                null));
        }

        public Task<AuthResult> LoginAsync(string email, string password, bool issueToken = true) =>
            throw new NotSupportedException();

        public Task<string> GenerateTokenAsync(Organizer organizer) => Task.FromResult("jwt");

        public Task<Organizer> ProcessOAuthCallbackAsync(
            OAuthProvider provider,
            string code,
            string redirectUri,
            string? deviceId = null) =>
            throw new NotSupportedException();

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

        public Task<string> IssueCodeAsync(Guid organizerId)
        {
            IssueCount++;
            LastOrganizerId = organizerId;
            return Task.FromResult("desktop-code");
        }

        public Task<string?> ExchangeAsync(string rawCode) => Task.FromResult<string?>(null);
    }
}
