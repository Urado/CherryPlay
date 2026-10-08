using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Tests;

internal sealed class FailFirstPasswordResetTokenRepository : IPasswordResetTokenRepository
{
    private int _callCount;

    public TaskCompletionSource<bool> FirstCallCompleted { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public TaskCompletionSource<bool> SecondCallCompleted { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public int CallCount => Volatile.Read(ref _callCount);

    public Task<PasswordResetToken> AddAsync(PasswordResetToken token) =>
        throw new NotSupportedException();

    public Task<PasswordResetToken?> GetValidByTokenHashAsync(string tokenHash) =>
        throw new NotSupportedException();

    public Task InvalidateUnusedByEmailAccountIdAsync(Guid emailAccountId) =>
        throw new NotSupportedException();

    public Task<bool> TryMarkUsedAsync(Guid tokenId) =>
        throw new NotSupportedException();

    public Task<bool> TryUnmarkUsedAsync(Guid tokenId) =>
        throw new NotSupportedException();

    public Task<int> DeleteStaleAsync(
        DateTime utcNow,
        TimeSpan retention,
        CancellationToken cancellationToken = default)
    {
        if (Interlocked.Increment(ref _callCount) == 1)
        {
            FirstCallCompleted.TrySetResult(true);
            throw new InvalidOperationException("Simulated transient database failure.");
        }

        SecondCallCompleted.TrySetResult(true);
        return Task.FromResult(0);
    }
}
