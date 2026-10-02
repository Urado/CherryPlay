using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Tests;

internal sealed class ConcurrentPartyShortCodeGenerator(int callersToRelease) : IShortCodeGenerator
{
    private readonly TaskCompletionSource _allCallersReady = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private int _callCount;

    public async Task<string> GenerateUniqueShortCodeAsync(Func<string, Task<bool>> uniquenessChecker, int maxRetries = 10)
    {
        if (Interlocked.Increment(ref _callCount) >= callersToRelease)
        {
            _allCallersReady.TrySetResult();
        }

        await _allCallersReady.Task;
        var code = $"R{Guid.NewGuid():N}"[..7];
        if (!await uniquenessChecker(code))
        {
            throw new InvalidOperationException("Generated a duplicate test short code.");
        }

        return code;
    }
}
