using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Email;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

public class AuthServiceForgotPasswordTests
{
    [Test]
    public async Task ForgotPassword_UnknownEmail_ReturnsGenericSuccess_WithoutCreatingToken()
    {
        var harness = PasswordFlowHarness.Dev();
        var result = await harness.AuthService.ForgotPasswordAsync("unknown@example.com");

        Assert.That(result.Success, Is.True);
        Assert.That(result.ServiceUnavailable, Is.False);
        Assert.That(result.Message, Is.EqualTo(AuthConstants.ForgotPasswordGenericMessage));
        Assert.That(harness.ResetTokens.All, Is.Empty);
        Assert.That(harness.RecordingSender!.Sent, Is.Empty);
    }

    [Test]
    public async Task ForgotPassword_KnownEmail_Dev_LoggingEmailSender_CreatesUsableToken()
    {
        var loggingSender = new LoggingEmailSender(NullLogger<LoggingEmailSender>.Instance);
        var harness = PasswordFlowHarness.Dev(emailConfigured: false, emailSender: loggingSender);
        var (_, account) = await harness.SeedEmailAccountAsync();

        var before = DateTime.UtcNow;
        var result = await harness.AuthService.ForgotPasswordAsync(account.Email);

        Assert.That(result.Success, Is.True);
        Assert.That(result.Message, Is.EqualTo(AuthConstants.ForgotPasswordGenericMessage));
        Assert.That(loggingSender.IsConfigured, Is.False);

        var tokens = harness.ResetTokens.All.Where(t => t.EmailAccountId == account.Id).ToArray();
        Assert.That(tokens, Has.Length.EqualTo(1));
        Assert.That(tokens[0].UsedAt, Is.Null);
        AssertExpiresNearTtl(tokens[0].ExpiresAt, before);

        var valid = await harness.ResetTokens.GetValidByTokenHashAsync(tokens[0].TokenHash);
        Assert.That(valid, Is.Not.Null);
    }

    [Test]
    public async Task ForgotPassword_Prod_MissingRuSenderConfig_ReturnsServiceUnavailable_BeforeLookup()
    {
        var harness = PasswordFlowHarness.Prod(emailConfigured: false, publicWebBaseUrl: "https://web.example");
        await harness.SeedEmailAccountAsync();

        var known = await harness.AuthService.ForgotPasswordAsync("user@example.com");
        var unknown = await harness.AuthService.ForgotPasswordAsync("nobody@example.com");

        Assert.That(known.Success, Is.False);
        Assert.That(known.ServiceUnavailable, Is.True);
        Assert.That(known.ErrorMessage, Is.EqualTo(AuthConstants.EmailServiceUnavailableMessage));
        Assert.That(unknown.Success, Is.False);
        Assert.That(unknown.ServiceUnavailable, Is.True);
        Assert.That(harness.ResetTokens.All, Is.Empty);
        Assert.That(harness.RecordingSender!.Sent, Is.Empty);
    }

    [Test]
    public async Task ForgotPassword_Prod_MissingPublicWebBaseUrl_ReturnsServiceUnavailable_BeforeLookup()
    {
        var harness = PasswordFlowHarness.Prod(emailConfigured: true, publicWebBaseUrl: null);
        await harness.SeedEmailAccountAsync();

        var known = await harness.AuthService.ForgotPasswordAsync("user@example.com");
        var unknown = await harness.AuthService.ForgotPasswordAsync("nobody@example.com");

        Assert.That(known.ServiceUnavailable, Is.True);
        Assert.That(unknown.ServiceUnavailable, Is.True);
        Assert.That(harness.ResetTokens.All, Is.Empty);
    }

    [Test]
    public async Task ForgotPassword_KnownEmail_ConfiguredSender_PersistsHashedToken_AndEmailsResetUrl()
    {
        var harness = PasswordFlowHarness.Prod(emailConfigured: true, publicWebBaseUrl: "https://web.example");
        var (_, account) = await harness.SeedEmailAccountAsync();

        var before = DateTime.UtcNow;
        var result = await harness.AuthService.ForgotPasswordAsync(account.Email);

        Assert.That(result.Success, Is.True);
        Assert.That(result.Message, Is.EqualTo(AuthConstants.ForgotPasswordGenericMessage));

        Assert.That(harness.RecordingSender!.Sent, Has.Count.EqualTo(1));
        var message = harness.RecordingSender.Sent[0];
        Assert.That(message.ToEmail, Is.EqualTo(account.Email));
        Assert.That(message.Subject, Is.EqualTo(AuthConstants.PasswordResetEmailSubject));
        Assert.That(message.TextBody, Does.Contain("https://web.example/reset-password?token="));

        var rawToken = PasswordFlowHarness.ExtractRawTokenFromResetUrl(message.TextBody);
        Assert.That(rawToken, Is.Not.Null.And.Not.Empty);

        var stored = harness.ResetTokens.All.Single();
        Assert.That(stored.TokenHash, Is.EqualTo(PasswordResetTokenHelper.HashToken(rawToken!)));
        Assert.That(stored.TokenHash, Does.Not.Contain(rawToken!));
        Assert.That(stored.TokenHash, Is.Not.EqualTo(rawToken));
        AssertExpiresNearTtl(stored.ExpiresAt, before);
    }

    [Test]
    public async Task ForgotPassword_KnownEmail_Prod_SendThrows_SoftFailsSuccess_AndKeepsTokenUsable()
    {
        var harness = PasswordFlowHarness.Prod(
            emailConfigured: true,
            sendException: new InvalidOperationException("RuSender down"));
        var (_, account) = await harness.SeedEmailAccountAsync();

        var result = await harness.AuthService.ForgotPasswordAsync(account.Email);

        Assert.That(result.Success, Is.True);
        Assert.That(result.ServiceUnavailable, Is.False);
        Assert.That(result.Message, Is.EqualTo(AuthConstants.ForgotPasswordGenericMessage));

        var token = harness.ResetTokens.All.Single();
        Assert.That(token.UsedAt, Is.Null);

        var valid = await harness.ResetTokens.GetValidByTokenHashAsync(token.TokenHash);
        Assert.That(valid, Is.Not.Null);

        var rawToken = PasswordFlowHarness.ExtractRawTokenFromResetUrl(harness.RecordingSender!.Sent[0].TextBody);
        Assert.That(rawToken, Is.Not.Null);
        var reset = await harness.AuthService.ResetPasswordAsync(rawToken!, "newpass1");
        Assert.That(reset.Success, Is.True);
    }

    [Test]
    public async Task ForgotPassword_KnownEmail_Dev_SendThrows_KeepsTokenUsable()
    {
        var harness = PasswordFlowHarness.Dev(
            emailConfigured: true,
            sendException: new InvalidOperationException("RuSender down"));
        var (_, account) = await harness.SeedEmailAccountAsync();

        var result = await harness.AuthService.ForgotPasswordAsync(account.Email);

        Assert.That(result.Success, Is.True);
        Assert.That(result.Message, Is.EqualTo(AuthConstants.ForgotPasswordGenericMessage));

        var token = harness.ResetTokens.All.Single();
        Assert.That(token.UsedAt, Is.Null);

        var valid = await harness.ResetTokens.GetValidByTokenHashAsync(token.TokenHash);
        Assert.That(valid, Is.Not.Null);

        var rawToken = PasswordFlowHarness.ExtractRawTokenFromResetUrl(harness.RecordingSender!.Sent[0].TextBody);
        Assert.That(rawToken, Is.Not.Null);
        var reset = await harness.AuthService.ResetPasswordAsync(rawToken!, "newpass1");
        Assert.That(reset.Success, Is.True);
    }

    [Test]
    public async Task ForgotPassword_InvalidatesPriorUnusedTokens_WhenNewForgotIssued()
    {
        var harness = PasswordFlowHarness.Prod(emailConfigured: true);
        var (_, account) = await harness.SeedEmailAccountAsync();

        var priorRaw = PasswordResetTokenHelper.GenerateRawToken();
        var prior = new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = account.Id,
            TokenHash = PasswordResetTokenHelper.HashToken(priorRaw),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            CreatedAt = DateTime.UtcNow,
        };
        await harness.ResetTokens.AddAsync(prior);

        var before = DateTime.UtcNow;
        var result = await harness.AuthService.ForgotPasswordAsync(account.Email);

        Assert.That(result.Success, Is.True);

        var priorAfter = harness.ResetTokens.All.Single(t => t.Id == prior.Id);
        Assert.That(priorAfter.UsedAt, Is.Not.Null);

        var priorValid = await harness.ResetTokens.GetValidByTokenHashAsync(prior.TokenHash);
        Assert.That(priorValid, Is.Null);

        var newest = harness.ResetTokens.All.Single(t => t.Id != prior.Id);
        Assert.That(newest.UsedAt, Is.Null);
        AssertExpiresNearTtl(newest.ExpiresAt, before);
        Assert.That(await harness.ResetTokens.GetValidByTokenHashAsync(newest.TokenHash), Is.Not.Null);

        var resetWithPrior = await harness.AuthService.ResetPasswordAsync(priorRaw, "newpass1");
        Assert.That(resetWithPrior.Success, Is.False);
    }

    [Test]
    public async Task ForgotPassword_InvalidEmail_ReturnsValidationFailure()
    {
        var harness = PasswordFlowHarness.Dev();
        var result = await harness.AuthService.ForgotPasswordAsync("not-an-email");

        Assert.That(result.Success, Is.False);
        Assert.That(result.ServiceUnavailable, Is.False);
        Assert.That(result.ErrorMessage, Is.EqualTo("Некорректный email"));
    }

    [Test]
    public async Task ForgotPassword_WhitespaceEmail_ReturnsValidationFailure()
    {
        var harness = PasswordFlowHarness.Dev();
        var result = await harness.AuthService.ForgotPasswordAsync("   ");

        Assert.That(result.Success, Is.False);
        Assert.That(result.ServiceUnavailable, Is.False);
        Assert.That(result.ErrorMessage, Is.EqualTo("Некорректный email"));
        Assert.That(harness.ResetTokens.All, Is.Empty);
    }

    private static void AssertExpiresNearTtl(DateTime expiresAt, DateTime beforeUtc)
    {
        var expected = beforeUtc.Add(AuthConstants.PasswordResetTokenTtl);
        Assert.That(
            expiresAt,
            Is.EqualTo(expected).Within(TimeSpan.FromSeconds(5)));
    }
}
