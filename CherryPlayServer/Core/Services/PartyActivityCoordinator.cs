using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Core.Services;

public sealed class PartyActivityCoordinator : IPartyActivityCoordinator
{
    private readonly SemaphoreSlim[] _locks = Enumerable.Range(0, 256)
        .Select(_ => new SemaphoreSlim(1, 1))
        .ToArray();

    public async Task<T> ExecuteAsync<T>(Guid partyId, Func<Task<T>> operation, CancellationToken cancellationToken = default)
    {
        var semaphore = _locks[partyId.GetHashCode() & 255];
        await semaphore.WaitAsync(cancellationToken);
        try
        {
            return await operation();
        }
        finally
        {
            semaphore.Release();
        }
    }

    public async Task ExecuteAsync(Guid partyId, Func<Task> operation, CancellationToken cancellationToken = default)
    {
        var semaphore = _locks[partyId.GetHashCode() & 255];
        await semaphore.WaitAsync(cancellationToken);
        try
        {
            await operation();
        }
        finally
        {
            semaphore.Release();
        }
    }
}
