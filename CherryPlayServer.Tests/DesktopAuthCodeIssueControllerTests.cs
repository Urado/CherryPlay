using CherryPlayServer.Controllers;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Mvc;

namespace CherryPlayServer.Tests;

public class DesktopAuthCodeIssueControllerTests
{
    [Test]
    public async Task IssueDesktopCode_WithOrganizer_ReturnsCode()
    {
        var organizerId = Guid.NewGuid();
        var desktopCodes = new RoundTripDesktopAuthCodeService();
        var controller = AuthControllerTestFactory.Create(
            new UnusedIssueAuthService(),
            organizerId: organizerId,
            desktopAuthCodeService: desktopCodes);

        var action = await controller.IssueDesktopCode();

        Assert.That(action.Result, Is.TypeOf<OkObjectResult>());
        var body = (DesktopAuthCodeResponse)((OkObjectResult)action.Result!).Value!;
        Assert.That(body.Code, Is.EqualTo(desktopCodes.LastIssuedCode));
        Assert.That(desktopCodes.LastOrganizerId, Is.EqualTo(organizerId));
    }

    [Test]
    public async Task IssueDesktopCode_WithoutOrganizer_Returns401()
    {
        var desktopCodes = new RoundTripDesktopAuthCodeService();
        var controller = AuthControllerTestFactory.Create(
            new UnusedIssueAuthService(),
            organizerId: null,
            desktopAuthCodeService: desktopCodes);

        var action = await controller.IssueDesktopCode();

        Assert.That(action.Result, Is.TypeOf<UnauthorizedResult>());
        Assert.That(desktopCodes.IssueCount, Is.EqualTo(0));
    }

    [Test]
    public async Task IssueDesktopCode_ThenExchange_ReturnsAccessToken()
    {
        var organizerId = Guid.NewGuid();
        var desktopCodes = new RoundTripDesktopAuthCodeService { ExchangeResult = "session-jwt" };
        var controller = AuthControllerTestFactory.Create(
            new UnusedIssueAuthService(),
            organizerId: organizerId,
            desktopAuthCodeService: desktopCodes);

        var issueAction = await controller.IssueDesktopCode();
        var issued = (DesktopAuthCodeResponse)((OkObjectResult)issueAction.Result!).Value!;

        var exchangeAction = await controller.ExchangeDesktopCode(
            new DesktopAuthExchangeRequest(issued.Code));

        Assert.That(exchangeAction.Result, Is.TypeOf<OkObjectResult>());
        var body = (AuthExchangeResponse)((OkObjectResult)exchangeAction.Result!).Value!;
        Assert.That(body.AccessToken, Is.EqualTo("session-jwt"));
        Assert.That(desktopCodes.LastExchangeCode, Is.EqualTo(issued.Code));
    }

    private sealed class UnusedIssueAuthService : IAuthService
    {
        public Task<AuthResult> LoginAsync(string email, string password, bool issueToken = true) =>
            throw new NotSupportedException();

        public Task<AuthResult> RegisterAsync(string email, string password, string name, bool issueToken = true) =>
            throw new NotSupportedException();

        public Task<string> GenerateTokenAsync(Organizer organizer) => Task.FromResult("unused");

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

    private sealed class RoundTripDesktopAuthCodeService : IDesktopAuthCodeService
    {
        public int IssueCount { get; private set; }
        public Guid? LastOrganizerId { get; private set; }
        public string? LastIssuedCode { get; private set; }
        public string? LastExchangeCode { get; private set; }
        public string? ExchangeResult { get; set; } = "exchanged-jwt";

        public Task<string> IssueCodeAsync(Guid organizerId)
        {
            IssueCount++;
            LastOrganizerId = organizerId;
            LastIssuedCode = $"code-{organizerId:N}";
            return Task.FromResult(LastIssuedCode);
        }

        public Task<string?> ExchangeAsync(string rawCode)
        {
            LastExchangeCode = rawCode;
            if (LastIssuedCode != null && rawCode == LastIssuedCode)
            {
                return Task.FromResult(ExchangeResult);
            }

            return Task.FromResult<string?>(null);
        }
    }
}
