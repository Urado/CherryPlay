using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Services;

namespace CherryPlayServer.Tests;

public class AuthServiceChangePasswordTests
{
    [Test]
    public async Task ChangePassword_CorrectOldPassword_UpdatesHash_RemovesSessions_InvalidatesResetTokens()
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

        var unusedRaw = PasswordResetTokenHelper.GenerateRawToken();
        await harness.ResetTokens.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = account.Id,
            TokenHash = PasswordResetTokenHelper.HashToken(unusedRaw),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            CreatedAt = DateTime.UtcNow,
        });

        var result = await harness.AuthService.ChangePasswordAsync(organizer.Id, "oldpass1", "newpass9");

        Assert.That(result.Success, Is.True);
        Assert.That(result.FailureKind, Is.Null);

        var updated = await harness.EmailAccounts.GetByIdAsync(account.Id);
        Assert.That(updated!.PasswordHash, Is.EqualTo(harness.PasswordHasher.HashPassword("newpass9")));
        Assert.That(harness.Sessions.CountByOrganizerId(organizer.Id), Is.EqualTo(0));

        var resetToken = harness.ResetTokens.All.Single();
        Assert.That(resetToken.UsedAt, Is.Not.Null);
        Assert.That(await harness.ResetTokens.GetValidByTokenHashAsync(resetToken.TokenHash), Is.Null);

        var resetWithOldToken = await harness.AuthService.ResetPasswordAsync(unusedRaw, "another1");
        Assert.That(resetWithOldToken.Success, Is.False);
    }

    [Test]
    public async Task ChangePassword_WrongOldPassword_ReturnsUnauthorized()
    {
        var harness = PasswordFlowHarness.Prod();
        var (organizer, _) = await harness.SeedEmailAccountAsync(password: "oldpass1");

        var result = await harness.AuthService.ChangePasswordAsync(organizer.Id, "wrong-old", "newpass9");

        Assert.That(result.Success, Is.False);
        Assert.That(result.FailureKind, Is.EqualTo(PasswordMutationFailureKind.Unauthorized));
        Assert.That(result.ErrorMessage, Is.EqualTo(AuthConstants.WrongCurrentPasswordMessage));
    }

    [Test]
    public async Task ChangePassword_NoEmailAccount_ReturnsNotAllowed()
    {
        var harness = PasswordFlowHarness.Prod();
        var organizer = new Organizer
        {
            Id = Guid.NewGuid(),
            Name = "OAuth Only",
            CreatedAt = DateTime.UtcNow,
        };
        await harness.Organizers.AddAsync(organizer);

        var result = await harness.AuthService.ChangePasswordAsync(organizer.Id, "anything", "newpass9");

        Assert.That(result.Success, Is.False);
        Assert.That(result.FailureKind, Is.EqualTo(PasswordMutationFailureKind.NotAllowed));
        Assert.That(result.ErrorMessage, Is.EqualTo(AuthConstants.ChangePasswordOAuthOnlyMessage));
    }

    [Test]
    public async Task ChangePassword_PasswordTooShort_ReturnsValidation()
    {
        var harness = PasswordFlowHarness.Prod();
        var (organizer, account) = await harness.SeedEmailAccountAsync(password: "oldpass1");
        var originalHash = account.PasswordHash;

        var result = await harness.AuthService.ChangePasswordAsync(organizer.Id, "oldpass1", "12345");

        Assert.That(result.Success, Is.False);
        Assert.That(result.FailureKind, Is.EqualTo(PasswordMutationFailureKind.Validation));
        Assert.That(result.ErrorMessage, Is.EqualTo(AuthConstants.PasswordTooShortMessage));

        var unchanged = await harness.EmailAccounts.GetByIdAsync(account.Id);
        Assert.That(unchanged!.PasswordHash, Is.EqualTo(originalHash));
    }

    [Test]
    public async Task ChangePassword_EmptyOldPassword_ReturnsUnauthorized()
    {
        var harness = PasswordFlowHarness.Prod();
        var (organizer, _) = await harness.SeedEmailAccountAsync(password: "oldpass1");

        var result = await harness.AuthService.ChangePasswordAsync(organizer.Id, "  ", "newpass9");

        Assert.That(result.Success, Is.False);
        Assert.That(result.FailureKind, Is.EqualTo(PasswordMutationFailureKind.Unauthorized));
    }
}
