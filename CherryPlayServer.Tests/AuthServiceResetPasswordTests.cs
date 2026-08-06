using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;

namespace CherryPlayServer.Tests;

public class AuthServiceResetPasswordTests
{
    [Test]
    public async Task ResetPassword_ValidToken_UpdatesHash_RemovesSessions_ConsumesToken()
    {
        var harness = PasswordFlowHarness.Prod();
        var (organizer, account) = await harness.SeedEmailAccountAsync(password: "oldpass1");
        await harness.Sessions.AddAsync(new OrganizerSession
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            CreatedAt = DateTime.UtcNow,
        });
        await harness.Sessions.AddAsync(new OrganizerSession
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            CreatedAt = DateTime.UtcNow,
        });

        var rawToken = await IssueResetTokenAsync(harness, account.Id);

        var result = await harness.AuthService.ResetPasswordAsync(rawToken, "newpass9");

        Assert.That(result.Success, Is.True);
        Assert.That(result.FailureKind, Is.Null);

        var updated = await harness.EmailAccounts.GetByIdAsync(account.Id);
        Assert.That(updated!.PasswordHash, Is.EqualTo(harness.PasswordHasher.HashPassword("newpass9")));
        Assert.That(harness.Sessions.CountByOrganizerId(organizer.Id), Is.EqualTo(0));

        var tokenAfter = harness.ResetTokens.All.Single();
        Assert.That(tokenAfter.UsedAt, Is.Not.Null);
        Assert.That(await harness.ResetTokens.GetValidByTokenHashAsync(tokenAfter.TokenHash), Is.Null);
    }

    [Test]
    public async Task ResetPassword_InvalidToken_ReturnsInvalidToken()
    {
        var harness = PasswordFlowHarness.Prod();
        var result = await harness.AuthService.ResetPasswordAsync("not-a-real-token", "newpass9");

        Assert.That(result.Success, Is.False);
        Assert.That(result.FailureKind, Is.EqualTo(PasswordMutationFailureKind.InvalidToken));
        Assert.That(result.ErrorMessage, Is.EqualTo(AuthConstants.PasswordResetInvalidTokenMessage));
    }

    [Test]
    public async Task ResetPassword_ExpiredToken_ReturnsInvalidToken()
    {
        var harness = PasswordFlowHarness.Prod();
        var (_, account) = await harness.SeedEmailAccountAsync();
        var rawToken = PasswordResetTokenHelper.GenerateRawToken();
        await harness.ResetTokens.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = account.Id,
            TokenHash = PasswordResetTokenHelper.HashToken(rawToken),
            ExpiresAt = DateTime.UtcNow.AddMinutes(-5),
            CreatedAt = DateTime.UtcNow.AddHours(-2),
        });

        var result = await harness.AuthService.ResetPasswordAsync(rawToken, "newpass9");

        Assert.That(result.Success, Is.False);
        Assert.That(result.FailureKind, Is.EqualTo(PasswordMutationFailureKind.InvalidToken));
    }

    [Test]
    public async Task ResetPassword_AlreadyUsedToken_ReturnsInvalidToken()
    {
        var harness = PasswordFlowHarness.Prod();
        var (_, account) = await harness.SeedEmailAccountAsync();
        var rawToken = PasswordResetTokenHelper.GenerateRawToken();
        await harness.ResetTokens.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = account.Id,
            TokenHash = PasswordResetTokenHelper.HashToken(rawToken),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            UsedAt = DateTime.UtcNow.AddMinutes(-1),
            CreatedAt = DateTime.UtcNow.AddMinutes(-10),
        });

        var result = await harness.AuthService.ResetPasswordAsync(rawToken, "newpass9");

        Assert.That(result.Success, Is.False);
        Assert.That(result.FailureKind, Is.EqualTo(PasswordMutationFailureKind.InvalidToken));
    }

    [Test]
    public async Task ResetPassword_PasswordTooShort_ReturnsValidation()
    {
        var harness = PasswordFlowHarness.Prod();
        var (_, account) = await harness.SeedEmailAccountAsync();
        var rawToken = await IssueResetTokenAsync(harness, account.Id);

        var result = await harness.AuthService.ResetPasswordAsync(rawToken, "12345");

        Assert.That(result.Success, Is.False);
        Assert.That(result.FailureKind, Is.EqualTo(PasswordMutationFailureKind.Validation));
        Assert.That(result.ErrorMessage, Is.EqualTo(AuthConstants.PasswordTooShortMessage));
        Assert.That(
            await harness.ResetTokens.GetValidByTokenHashAsync(PasswordResetTokenHelper.HashToken(rawToken)),
            Is.Not.Null);
    }

    [Test]
    public async Task ResetPassword_TokenIsSingleUse_SecondResetFails()
    {
        var harness = PasswordFlowHarness.Prod();
        var (_, account) = await harness.SeedEmailAccountAsync();
        var rawToken = await IssueResetTokenAsync(harness, account.Id);

        var first = await harness.AuthService.ResetPasswordAsync(rawToken, "newpass9");
        var second = await harness.AuthService.ResetPasswordAsync(rawToken, "another1");

        Assert.That(first.Success, Is.True);
        Assert.That(second.Success, Is.False);
        Assert.That(second.FailureKind, Is.EqualTo(PasswordMutationFailureKind.InvalidToken));
    }

    [Test]
    public async Task ResetPassword_EmptyToken_ReturnsInvalidToken()
    {
        var harness = PasswordFlowHarness.Prod();
        var result = await harness.AuthService.ResetPasswordAsync("   ", "newpass9");

        Assert.That(result.Success, Is.False);
        Assert.That(result.FailureKind, Is.EqualTo(PasswordMutationFailureKind.InvalidToken));
    }

    [Test]
    public async Task TryMarkUsed_SecondClaimFails_ApplicatorIsAtomicForSingleUse()
    {
        var tokens = new TestPasswordResetTokenRepository();
        var emailAccounts = new InMemoryEmailAccountRepository();
        var sessions = new TestOrganizerSessionRepository();
        var hasher = new FastPasswordHasher();

        var organizerId = Guid.NewGuid();
        var account = new EmailAccount
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizerId,
            Email = "user@example.com",
            PasswordHash = hasher.HashPassword("oldpass1"),
            CreatedAt = DateTime.UtcNow,
        };
        await emailAccounts.AddAsync(account);
        await sessions.AddAsync(new OrganizerSession
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizerId,
            CreatedAt = DateTime.UtcNow,
        });

        var token = new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = account.Id,
            TokenHash = PasswordResetTokenHelper.HashToken("raw-token"),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            CreatedAt = DateTime.UtcNow,
        };
        await tokens.AddAsync(token);

        var applicator = new InMemoryPasswordResetApplicator(tokens, emailAccounts, sessions);
        var first = await applicator.ApplyAsync(token.Id, account.Id, hasher.HashPassword("newpass9"));
        var second = await applicator.ApplyAsync(token.Id, account.Id, hasher.HashPassword("other99"));

        Assert.That(first, Is.True);
        Assert.That(second, Is.False);

        var updated = await emailAccounts.GetByIdAsync(account.Id);
        Assert.That(updated!.PasswordHash, Is.EqualTo(hasher.HashPassword("newpass9")));
        Assert.That(sessions.CountByOrganizerId(organizerId), Is.EqualTo(0));
    }

    [Test]
    public async Task ApplyAsync_MissingEmailAccount_UnmarksClaimedToken()
    {
        var tokens = new TestPasswordResetTokenRepository();
        var emailAccounts = new InMemoryEmailAccountRepository();
        var sessions = new TestOrganizerSessionRepository();
        var hasher = new FastPasswordHasher();

        var token = new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = Guid.NewGuid(),
            TokenHash = PasswordResetTokenHelper.HashToken("orphan-token"),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            CreatedAt = DateTime.UtcNow,
        };
        await tokens.AddAsync(token);

        var applicator = new InMemoryPasswordResetApplicator(tokens, emailAccounts, sessions);
        var applied = await applicator.ApplyAsync(token.Id, token.EmailAccountId, hasher.HashPassword("newpass9"));

        Assert.That(applied, Is.False);
        Assert.That(tokens.All.Single().UsedAt, Is.Null);
        Assert.That(await tokens.GetValidByTokenHashAsync(token.TokenHash), Is.Not.Null);
    }

    [Test]
    public async Task ApplyPasswordChangeAsync_UpdatesHash_InvalidatesTokens_RemovesSessions()
    {
        var tokens = new TestPasswordResetTokenRepository();
        var emailAccounts = new InMemoryEmailAccountRepository();
        var sessions = new TestOrganizerSessionRepository();
        var hasher = new FastPasswordHasher();

        var organizerId = Guid.NewGuid();
        var account = new EmailAccount
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizerId,
            Email = "user@example.com",
            PasswordHash = hasher.HashPassword("oldpass1"),
            CreatedAt = DateTime.UtcNow,
        };
        await emailAccounts.AddAsync(account);
        await sessions.AddAsync(new OrganizerSession
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizerId,
            CreatedAt = DateTime.UtcNow,
        });
        await tokens.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = account.Id,
            TokenHash = PasswordResetTokenHelper.HashToken("unused"),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            CreatedAt = DateTime.UtcNow,
        });

        var applicator = new InMemoryPasswordResetApplicator(tokens, emailAccounts, sessions);
        await applicator.ApplyPasswordChangeAsync(account.Id, organizerId, hasher.HashPassword("newpass9"));

        var updated = await emailAccounts.GetByIdAsync(account.Id);
        Assert.That(updated!.PasswordHash, Is.EqualTo(hasher.HashPassword("newpass9")));
        Assert.That(sessions.CountByOrganizerId(organizerId), Is.EqualTo(0));
        Assert.That(tokens.All.Single().UsedAt, Is.Not.Null);
    }

    private static async Task<string> IssueResetTokenAsync(PasswordFlowHarness harness, Guid emailAccountId)
    {
        await harness.AuthService.ForgotPasswordAsync("user@example.com");
        var raw = PasswordFlowHarness.ExtractRawTokenFromResetUrl(harness.RecordingSender!.Sent[^1].TextBody);
        Assert.That(raw, Is.Not.Null);
        Assert.That(harness.ResetTokens.All.Any(t => t.EmailAccountId == emailAccountId && t.UsedAt == null), Is.True);
        return raw!;
    }
}
