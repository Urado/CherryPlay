using CherryPlayServer.Controllers;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CherryPlayServer.Tests;

public class DesktopAuthAllowlistTests
{
    [TestCase("cherryplaylist://auth", true)]
    [TestCase("cherryplaylist://auth/extra", true)]
    [TestCase("http://localhost:5173/auth/callback", true)]
    [TestCase("http://localhost:5174/auth/callback", true)]
    [TestCase("http://127.0.0.1:5173/auth/callback", true)]
    [TestCase("http://127.0.0.1:5174/auth/callback", true)]
    [TestCase("https://localhost:5173/auth/callback", false)]
    [TestCase("https://127.0.0.1:5173/auth/callback", false)]
    [TestCase("http://evil.example/auth/callback", false)]
    [TestCase("http://localhost:3000/auth/callback", false)]
    [TestCase("http://localhost:5173/other", false)]
    [TestCase("http://localhost:5173/auth/callback/extra", false)]
    [TestCase("http://127.0.0.1:8080/auth/callback", false)]
    public async Task StartWebAuth_ReturnToAllowlistMatrix(string returnTo, bool expectedAllowed)
    {
        var recordingState = new RecordingOAuthStateService();
        var controller = AuthControllerTestFactory.Create(
            new UnusedAllowlistAuthService(),
            oauthStateService: recordingState,
            configureHttpContext: ctx =>
            {
                ctx.Request.Scheme = "https";
                ctx.Request.Host = new HostString("api.example");
            });

        var action = await controller.StartWebAuth(
            "vk",
            client: AuthConstants.DesktopClientValue,
            return_to: returnTo);

        Assert.That(action, Is.TypeOf<RedirectResult>());
        Assert.That(recordingState.LastClient, Is.EqualTo(AuthConstants.DesktopClientValue));
        if (expectedAllowed)
        {
            Assert.That(recordingState.LastReturnTo, Is.EqualTo(returnTo));
        }
        else
        {
            Assert.That(recordingState.LastReturnTo, Is.Null);
        }
    }

    [TestCase("cherryplaylist://auth", true)]
    [TestCase("http://127.0.0.1:5173", true)]
    [TestCase("http://127.0.0.1:5174", true)]
    [TestCase("http://127.0.0.1:3000", true)]
    [TestCase("http://localhost:5173", false)]
    [TestCase("https://evil.example/callback", false)]
    [TestCase("http://evil.example/", false)]
    public async Task StartDesktopAuth_RedirectUriAllowlist(string redirectUri, bool expectedAllowed)
    {
        var controller = AuthControllerTestFactory.Create(
            new UnusedAllowlistAuthService(),
            configureHttpContext: ctx =>
            {
                ctx.Request.Scheme = "https";
                ctx.Request.Host = new HostString("api.example");
            });

        var action = await controller.StartDesktopAuth("vk", redirectUri);

        if (expectedAllowed)
        {
            Assert.That(action, Is.TypeOf<RedirectResult>());
        }
        else
        {
            Assert.That(action, Is.TypeOf<BadRequestObjectResult>());
            Assert.That(((BadRequestObjectResult)action).Value, Is.EqualTo("Invalid redirect URI"));
        }
    }

    private sealed class UnusedAllowlistAuthService : IAuthService
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
