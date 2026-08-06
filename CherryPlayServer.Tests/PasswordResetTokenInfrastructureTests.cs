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
}
