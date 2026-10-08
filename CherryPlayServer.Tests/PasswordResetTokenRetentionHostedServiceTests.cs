using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Data;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

public class PasswordResetTokenRetentionHostedServiceTests
{
    [Test]
    public void AuthConstants_RetentionEqualsThirtyDaysMinusCleanupInterval()
    {
        Assert.That(
            AuthConstants.PasswordResetTokenRetentionCleanupInterval,
            Is.EqualTo(TimeSpan.FromHours(1)));
        Assert.That(
            AuthConstants.PasswordResetTokenRecordRetention,
            Is.EqualTo(TimeSpan.FromDays(30) - AuthConstants.PasswordResetTokenRetentionCleanupInterval));
        Assert.That(
            AuthConstants.PasswordResetTokenRecordRetention + AuthConstants.PasswordResetTokenRetentionCleanupInterval,
            Is.EqualTo(TimeSpan.FromDays(30)));
    }

    [Test]
    public void Di_RegistersPasswordResetTokenRetentionCleanupHostedService()
    {
        var services = new ServiceCollection();
        services.AddHostedService<PasswordResetTokenRetentionCleanupHostedService>();

        Assert.That(
            services.Any(d =>
                d.ServiceType == typeof(IHostedService)
                && d.ImplementationType == typeof(PasswordResetTokenRetentionCleanupHostedService)),
            Is.True);
    }

    [Test]
    public async Task ExecuteAsync_CallsDeleteStaleWithConfiguredRetention()
    {
        var repo = new RecordingPasswordResetTokenRepository();
        var services = new ServiceCollection();
        services.AddSingleton<IPasswordResetTokenRepository>(repo);
        var provider = services.BuildServiceProvider();
        var scopeFactory = provider.GetRequiredService<IServiceScopeFactory>();

        using var cts = new CancellationTokenSource();
        var hosted = new PasswordResetTokenRetentionCleanupHostedService(
            scopeFactory,
            NullLogger<PasswordResetTokenRetentionCleanupHostedService>.Instance);

        var run = hosted.StartAsync(cts.Token);
        Assert.That(
            await WaitUntilAsync(() => repo.DeleteStaleCallCount > 0, TimeSpan.FromSeconds(5)),
            Is.True);

        await cts.CancelAsync();
        await hosted.StopAsync(CancellationToken.None);
        await run;

        Assert.That(repo.DeleteStaleCallCount, Is.GreaterThanOrEqualTo(1));
        Assert.That(repo.LastRetention, Is.EqualTo(AuthConstants.PasswordResetTokenRecordRetention));
    }

    private static async Task<bool> WaitUntilAsync(Func<bool> condition, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (condition())
            {
                return true;
            }

            await Task.Delay(20);
        }

        return condition();
    }

    private sealed class RecordingPasswordResetTokenRepository : IPasswordResetTokenRepository
    {
        public int DeleteStaleCallCount { get; private set; }
        public TimeSpan? LastRetention { get; private set; }

        public Task<PasswordResetToken> AddAsync(PasswordResetToken token) =>
            Task.FromResult(token);

        public Task<PasswordResetToken?> GetValidByTokenHashAsync(string tokenHash) =>
            Task.FromResult<PasswordResetToken?>(null);

        public Task InvalidateUnusedByEmailAccountIdAsync(Guid emailAccountId) =>
            Task.CompletedTask;

        public Task<bool> TryMarkUsedAsync(Guid tokenId) =>
            Task.FromResult(false);

        public Task<bool> TryUnmarkUsedAsync(Guid tokenId) =>
            Task.FromResult(false);

        public Task<int> DeleteStaleAsync(
            DateTime utcNow,
            TimeSpan retention,
            CancellationToken cancellationToken = default)
        {
            DeleteStaleCallCount++;
            LastRetention = retention;
            return Task.FromResult(0);
        }
    }
}
