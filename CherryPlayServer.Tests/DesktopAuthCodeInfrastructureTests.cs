using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

public class DesktopAuthCodeInfrastructureTests
{
    [Test]
    public async Task InMemoryRepository_GetValid_IgnoresExpiredAndUsed()
    {
        var repo = new InMemoryDesktopAuthCodeRepository();
        var organizerId = Guid.NewGuid();
        var validRaw = PasswordResetTokenHelper.GenerateRawToken();
        var expiredRaw = PasswordResetTokenHelper.GenerateRawToken();
        var usedRaw = PasswordResetTokenHelper.GenerateRawToken();

        await repo.AddAsync(new DesktopAuthCode
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizerId,
            TokenHash = PasswordResetTokenHelper.HashToken(validRaw),
            ExpiresAt = DateTime.UtcNow.AddMinutes(3),
            CreatedAt = DateTime.UtcNow,
        });
        await repo.AddAsync(new DesktopAuthCode
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizerId,
            TokenHash = PasswordResetTokenHelper.HashToken(expiredRaw),
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1),
            CreatedAt = DateTime.UtcNow.AddHours(-1),
        });
        await repo.AddAsync(new DesktopAuthCode
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizerId,
            TokenHash = PasswordResetTokenHelper.HashToken(usedRaw),
            ExpiresAt = DateTime.UtcNow.AddMinutes(3),
            UsedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        });

        Assert.That(await repo.GetValidByTokenHashAsync(PasswordResetTokenHelper.HashToken(validRaw)), Is.Not.Null);
        Assert.That(await repo.GetValidByTokenHashAsync(PasswordResetTokenHelper.HashToken(expiredRaw)), Is.Null);
        Assert.That(await repo.GetValidByTokenHashAsync(PasswordResetTokenHelper.HashToken(usedRaw)), Is.Null);
    }

    [Test]
    public async Task InMemoryRepository_TryMarkUsed_IsSingleUse()
    {
        var repo = new InMemoryDesktopAuthCodeRepository();
        var code = new DesktopAuthCode
        {
            Id = Guid.NewGuid(),
            OrganizerId = Guid.NewGuid(),
            TokenHash = PasswordResetTokenHelper.HashToken("once"),
            ExpiresAt = DateTime.UtcNow.AddMinutes(3),
            CreatedAt = DateTime.UtcNow,
        };
        await repo.AddAsync(code);

        Assert.That(await repo.TryMarkUsedAsync(code.Id), Is.True);
        Assert.That(await repo.TryMarkUsedAsync(code.Id), Is.False);
        Assert.That(await repo.GetValidByTokenHashAsync(code.TokenHash), Is.Null);
    }

    [Test]
    public void OAuthStateService_StoresAndReturnsDesktopClient()
    {
        var cache = new Microsoft.Extensions.Caching.Memory.MemoryCache(
            new Microsoft.Extensions.Caching.Memory.MemoryCacheOptions());
        var service = new OAuthStateService(cache);

        var state = service.GenerateAndStoreState("vk", AuthConstants.DesktopClientValue);
        var result = service.ValidateAndConsumeStateWithClient(state, "vk");

        Assert.That(result, Is.Not.Null);
        Assert.That(result!.Client, Is.EqualTo(AuthConstants.DesktopClientValue));
    }

    [Test]
    public void OAuthStateService_WithoutClient_ReturnsNullClient()
    {
        var cache = new Microsoft.Extensions.Caching.Memory.MemoryCache(
            new Microsoft.Extensions.Caching.Memory.MemoryCacheOptions());
        var service = new OAuthStateService(cache);

        var state = service.GenerateAndStoreState("vk");
        var result = service.ValidateAndConsumeStateWithClient(state, "vk");

        Assert.That(result, Is.Not.Null);
        Assert.That(result!.Client, Is.Null);
    }
}
