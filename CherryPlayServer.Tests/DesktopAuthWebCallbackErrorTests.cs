using CherryPlayServer.Controllers;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace CherryPlayServer.Tests;

public class DesktopAuthWebCallbackErrorTests
{
    [Test]
    public async Task WebCallback_MissingCode_ReturnsBadRequest()
    {
        var controller = AuthControllerTestFactory.Create(new StubAuthService(Guid.NewGuid()));

        var action = await controller.WebCallback("vk", code: null, state: "state");

        Assert.That(action, Is.TypeOf<BadRequestObjectResult>());
        Assert.That(((BadRequestObjectResult)action).Value, Is.EqualTo("Authorization code is missing"));
    }

    [Test]
    public async Task WebCallback_EmptyCode_ReturnsBadRequest()
    {
        var controller = AuthControllerTestFactory.Create(new StubAuthService(Guid.NewGuid()));

        var action = await controller.WebCallback("vk", code: "", state: "state");

        Assert.That(action, Is.TypeOf<BadRequestObjectResult>());
        Assert.That(((BadRequestObjectResult)action).Value, Is.EqualTo("Authorization code is missing"));
    }

    [Test]
    public async Task WebCallback_InvalidState_RedirectsToLoginWithError()
    {
        var controller = AuthControllerTestFactory.Create(
            new StubAuthService(Guid.NewGuid()),
            oauthStateService: new ConfigurableOAuthStateService { ConsumeResult = null },
            configureHttpContext: ctx =>
            {
                ctx.Request.Scheme = "https";
                ctx.Request.Host = new HostString("localhost");
            });

        var action = await controller.WebCallback("vk", "oauth-code", "bad-state");

        Assert.That(action, Is.TypeOf<RedirectResult>());
        var redirect = (RedirectResult)action;
        Assert.That(redirect.Url, Does.StartWith("/login?error="));
        Assert.That(redirect.Url, Does.Contain("Invalid"));
    }

    [Test]
    public async Task WebCallback_OAuthException_RedirectsToLoginWithError()
    {
        var controller = AuthControllerTestFactory.Create(
            new ThrowingOAuthAuthService(),
            oauthStateService: new ConfigurableOAuthStateService
            {
                ConsumeResult = new OAuthStateConsumeResult(null),
            },
            configureHttpContext: ctx =>
            {
                ctx.Request.Scheme = "https";
                ctx.Request.Host = new HostString("localhost");
            });

        var action = await controller.WebCallback("vk", "oauth-code", "state");

        Assert.That(action, Is.TypeOf<RedirectResult>());
        var redirect = (RedirectResult)action;
        Assert.That(redirect.Url, Does.StartWith("/login?error="));
        Assert.That(redirect.Url, Does.Contain("Authentication+failed"));
    }

    [Test]
    public async Task WebCallback_PublicWebBaseUrl_DisallowedReturnTo_OmitsReturnToOnLoginRedirect()
    {
        var desktopCodes = new StubDesktopAuthCodeService();
        var controller = AuthControllerTestFactory.Create(
            new StubAuthService(Guid.NewGuid()),
            desktopAuthCodeService: desktopCodes,
            oauthStateService: new ConfigurableOAuthStateService
            {
                ConsumeResult = new OAuthStateConsumeResult(
                    AuthConstants.DesktopClientValue,
                    "https://evil.example/steal"),
            },
            configuration: new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["PUBLIC_WEB_BASE_URL"] = "https://web.example",
                })
                .Build(),
            configureHttpContext: ctx =>
            {
                ctx.Request.Scheme = "https";
                ctx.Request.Host = new HostString("localhost");
            });

        var action = await controller.WebCallback("vk", "oauth-code", "state");

        Assert.That(action, Is.TypeOf<RedirectResult>());
        var redirect = (RedirectResult)action;
        Assert.That(
            redirect.Url,
            Is.EqualTo("https://web.example/login?client=desktop&code=issued-code"));
        Assert.That(redirect.Url, Does.Not.Contain("return_to"));
        Assert.That(redirect.Url, Does.Not.Contain("evil.example"));
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

    private sealed class ThrowingOAuthAuthService : IAuthService
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
            throw new InvalidOperationException("oauth failed");

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
        public Task<string> IssueCodeAsync(Guid organizerId) => Task.FromResult("issued-code");

        public Task<string?> ExchangeAsync(string rawCode) => Task.FromResult<string?>(null);
    }
}
