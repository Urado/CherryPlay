using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;

namespace CherryPlayServer.Tests;

public class PasswordResetTokenInfrastructureTests
{
    [Test]
    public void HashToken_IsDeterministic_AndNotEqualToRaw()
    {
        const string raw = "abc123-raw-token";
        var hash1 = PasswordResetTokenHelper.HashToken(raw);
        var hash2 = PasswordResetTokenHelper.HashToken(raw);

        Assert.That(hash1, Is.EqualTo(hash2));
        Assert.That(hash1, Is.Not.EqualTo(raw));
        Assert.That(hash1, Does.Match("^[0-9a-f]{64}$"));
    }

    [Test]
    public void HashToken_DifferentInputs_ProduceDifferentHashes()
    {
        var a = PasswordResetTokenHelper.HashToken("token-a");
        var b = PasswordResetTokenHelper.HashToken("token-b");
        Assert.That(a, Is.Not.EqualTo(b));
    }

    [Test]
    public void GenerateRawToken_ProducesUrlSafeNonEmptyValue()
    {
        var token = PasswordResetTokenHelper.GenerateRawToken();
        Assert.That(token, Is.Not.Null.And.Not.Empty);
        Assert.That(token, Does.Not.Contain("+"));
        Assert.That(token, Does.Not.Contain("/"));
        Assert.That(token, Does.Not.Contain("="));
    }

    [Test]
    public async Task InMemoryRepository_GetValid_IgnoresExpiredAndUsed()
    {
        var repo = new InMemoryPasswordResetTokenRepository();
        var emailAccountId = Guid.NewGuid();
        var validRaw = PasswordResetTokenHelper.GenerateRawToken();
        var expiredRaw = PasswordResetTokenHelper.GenerateRawToken();
        var usedRaw = PasswordResetTokenHelper.GenerateRawToken();

        await repo.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = emailAccountId,
            TokenHash = PasswordResetTokenHelper.HashToken(validRaw),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            CreatedAt = DateTime.UtcNow,
        });
        await repo.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = emailAccountId,
            TokenHash = PasswordResetTokenHelper.HashToken(expiredRaw),
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1),
            CreatedAt = DateTime.UtcNow.AddHours(-2),
        });
        await repo.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = emailAccountId,
            TokenHash = PasswordResetTokenHelper.HashToken(usedRaw),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            UsedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        });

        Assert.That(await repo.GetValidByTokenHashAsync(PasswordResetTokenHelper.HashToken(validRaw)), Is.Not.Null);
        Assert.That(await repo.GetValidByTokenHashAsync(PasswordResetTokenHelper.HashToken(expiredRaw)), Is.Null);
        Assert.That(await repo.GetValidByTokenHashAsync(PasswordResetTokenHelper.HashToken(usedRaw)), Is.Null);
    }

    [Test]
    public async Task InMemoryRepository_InvalidateUnused_MarksOnlyUnusedForAccount()
    {
        var repo = new InMemoryPasswordResetTokenRepository();
        var accountA = Guid.NewGuid();
        var accountB = Guid.NewGuid();
        var tokenA = new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = accountA,
            TokenHash = PasswordResetTokenHelper.HashToken("a"),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            CreatedAt = DateTime.UtcNow,
        };
        var tokenB = new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = accountB,
            TokenHash = PasswordResetTokenHelper.HashToken("b"),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            CreatedAt = DateTime.UtcNow,
        };
        await repo.AddAsync(tokenA);
        await repo.AddAsync(tokenB);

        await repo.InvalidateUnusedByEmailAccountIdAsync(accountA);

        Assert.That(await repo.GetValidByTokenHashAsync(tokenA.TokenHash), Is.Null);
        Assert.That(await repo.GetValidByTokenHashAsync(tokenB.TokenHash), Is.Not.Null);
    }

    [Test]
    public async Task InMemoryRepository_TryMarkUsed_IsSingleUse()
    {
        var repo = new InMemoryPasswordResetTokenRepository();
        var token = new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = Guid.NewGuid(),
            TokenHash = PasswordResetTokenHelper.HashToken("once"),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            CreatedAt = DateTime.UtcNow,
        };
        await repo.AddAsync(token);

        Assert.That(await repo.TryMarkUsedAsync(token.Id), Is.True);
        Assert.That(await repo.TryMarkUsedAsync(token.Id), Is.False);
        Assert.That(await repo.GetValidByTokenHashAsync(token.TokenHash), Is.Null);
    }

    [Test]
    public async Task InMemoryRepository_TryUnmarkUsed_RestoresUsability()
    {
        var repo = new InMemoryPasswordResetTokenRepository();
        var token = new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = Guid.NewGuid(),
            TokenHash = PasswordResetTokenHelper.HashToken("claim-then-unmark"),
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            CreatedAt = DateTime.UtcNow,
        };
        await repo.AddAsync(token);

        Assert.That(await repo.TryMarkUsedAsync(token.Id), Is.True);
        Assert.That(await repo.TryUnmarkUsedAsync(token.Id), Is.True);
        Assert.That(await repo.GetValidByTokenHashAsync(token.TokenHash), Is.Not.Null);
        Assert.That(await repo.TryMarkUsedAsync(token.Id), Is.True);
    }

    [Test]
    public async Task InMemoryRepository_DeleteStale_KeepsActiveAndYoung_DeletesOldUsedAndExpired()
    {
        var repo = new InMemoryPasswordResetTokenRepository();
        var emailAccountId = Guid.NewGuid();
        var utcNow = DateTime.UtcNow;
        var retention = AuthConstants.PasswordResetTokenRecordRetention;
        var activeHash = PasswordResetTokenHelper.HashToken("active");

        await repo.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = emailAccountId,
            TokenHash = activeHash,
            ExpiresAt = utcNow.AddHours(1),
            CreatedAt = utcNow,
        });
        await repo.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = emailAccountId,
            TokenHash = PasswordResetTokenHelper.HashToken("used-old"),
            ExpiresAt = utcNow.AddDays(-40),
            UsedAt = utcNow.AddDays(-31),
            CreatedAt = utcNow.AddDays(-40),
        });
        await repo.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = emailAccountId,
            TokenHash = PasswordResetTokenHelper.HashToken("expired-old"),
            ExpiresAt = utcNow.AddDays(-31),
            CreatedAt = utcNow.AddDays(-32),
        });
        await repo.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = emailAccountId,
            TokenHash = PasswordResetTokenHelper.HashToken("used-young"),
            ExpiresAt = utcNow.AddDays(-5),
            UsedAt = utcNow.AddDays(-10),
            CreatedAt = utcNow.AddDays(-11),
        });
        await repo.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = emailAccountId,
            TokenHash = PasswordResetTokenHelper.HashToken("expired-young"),
            ExpiresAt = utcNow.AddDays(-10),
            CreatedAt = utcNow.AddDays(-11),
        });

        var deleted = await repo.DeleteStaleAsync(utcNow, retention);
        Assert.That(deleted, Is.EqualTo(2));
        Assert.That(await repo.GetValidByTokenHashAsync(activeHash), Is.Not.Null);

        var secondPass = await repo.DeleteStaleAsync(utcNow, retention);
        Assert.That(secondPass, Is.EqualTo(0));

        var youngDeleted = await repo.DeleteStaleAsync(utcNow, TimeSpan.FromDays(5));
        Assert.That(youngDeleted, Is.EqualTo(2));
        Assert.That(await repo.GetValidByTokenHashAsync(activeHash), Is.Not.Null);
        Assert.That(await repo.DeleteStaleAsync(utcNow, TimeSpan.FromDays(5)), Is.EqualTo(0));
    }

    [Test]
    public async Task InMemoryRepository_DeleteStale_ExactCutoffBoundary_DeletesAtOrBefore_KeepsOneSecondFresher()
    {
        var repo = new InMemoryPasswordResetTokenRepository();
        var emailAccountId = Guid.NewGuid();
        var utcNow = new DateTime(2026, 9, 23, 12, 0, 0, DateTimeKind.Utc);
        var retention = AuthConstants.PasswordResetTokenRecordRetention;
        var cutoff = utcNow - retention;
        var usedAtCutoffHash = PasswordResetTokenHelper.HashToken("used-at-cutoff");
        var usedJustInsideHash = PasswordResetTokenHelper.HashToken("used-just-inside");
        var expiredAtCutoffHash = PasswordResetTokenHelper.HashToken("expired-at-cutoff");
        var expiredJustInsideHash = PasswordResetTokenHelper.HashToken("expired-just-inside");

        await repo.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = emailAccountId,
            TokenHash = usedAtCutoffHash,
            ExpiresAt = cutoff.AddDays(-1),
            UsedAt = cutoff,
            CreatedAt = cutoff.AddDays(-1),
        });
        await repo.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = emailAccountId,
            TokenHash = usedJustInsideHash,
            ExpiresAt = cutoff.AddDays(-1),
            UsedAt = cutoff.AddSeconds(1),
            CreatedAt = cutoff.AddDays(-1),
        });
        await repo.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = emailAccountId,
            TokenHash = expiredAtCutoffHash,
            ExpiresAt = cutoff,
            CreatedAt = cutoff.AddDays(-1),
        });
        await repo.AddAsync(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            EmailAccountId = emailAccountId,
            TokenHash = expiredJustInsideHash,
            ExpiresAt = cutoff.AddSeconds(1),
            CreatedAt = cutoff.AddDays(-1),
        });

        var deleted = await repo.DeleteStaleAsync(utcNow, retention);
        Assert.That(deleted, Is.EqualTo(2));
        Assert.That(await repo.DeleteStaleAsync(utcNow, retention), Is.EqualTo(0));
        Assert.That(
            await repo.DeleteStaleAsync(utcNow, retention - TimeSpan.FromSeconds(1)),
            Is.EqualTo(2));
    }
}
