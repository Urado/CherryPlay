namespace CherryPlayServer.Core.Interfaces;

public interface IPartyActivityCoordinator
{
    Task<T> ExecuteAsync<T>(Guid partyId, Func<Task<T>> operation, CancellationToken cancellationToken = default);
    Task ExecuteAsync(Guid partyId, Func<Task> operation, CancellationToken cancellationToken = default);
}
