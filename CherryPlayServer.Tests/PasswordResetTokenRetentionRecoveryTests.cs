using CherryPlayServer.Infrastructure.Data;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class PasswordResetTokenRetentionRecoveryTests
{
    [Test]
    public async Task CleanupFailure_LeavesBackgroundServiceRunningUntilCancellation()
    {
        var repository = new FailFirstPasswordResetTokenRepository();
        var firstDelayStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseFirstDelay = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var delayCalls = 0;
        var services = new ServiceCollection();
        services.AddSingleton<CherryPlayServer.Core.Interfaces.IPasswordResetTokenRepository>(repository);
        using var provider = services.BuildServiceProvider();
        var hosted = new PasswordResetTokenRetentionCleanupHostedService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<PasswordResetTokenRetentionCleanupHostedService>.Instance,
            async (_, token) =>
            {
                if (Interlocked.Increment(ref delayCalls) == 1)
                {
                    firstDelayStarted.TrySetResult(true);
                    await releaseFirstDelay.Task.WaitAsync(token);
                    return;
                }

                await Task.Delay(Timeout.InfiniteTimeSpan, token);
            });
        using var cancellation = new CancellationTokenSource();

        await hosted.StartAsync(cancellation.Token);
        Assert.That(await repository.FirstCallCompleted.Task.WaitAsync(TimeSpan.FromSeconds(5)), Is.True);
        Assert.That(await firstDelayStarted.Task.WaitAsync(TimeSpan.FromSeconds(5)), Is.True);
        releaseFirstDelay.TrySetResult(true);
        Assert.That(await repository.SecondCallCompleted.Task.WaitAsync(TimeSpan.FromSeconds(5)), Is.True);
        Assert.That(hosted.ExecuteTask!.IsCompleted, Is.False);

        await cancellation.CancelAsync();
        await hosted.StopAsync(CancellationToken.None);

        Assert.That(hosted.ExecuteTask.IsCanceled, Is.True);
        Assert.That(repository.CallCount, Is.EqualTo(2));
    }
}
