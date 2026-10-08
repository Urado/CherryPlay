using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IConsentEventRepository
{
    Task<IReadOnlyList<ConsentEvent>> ListBySubjectAsync(Guid subjectId, CancellationToken cancellationToken = default);
    Task<ConsentEvent?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> TryAddAsync(ConsentEvent consentEvent, CancellationToken cancellationToken = default);
    Task<bool> TryAddBatchAsync(IReadOnlyList<ConsentEvent> events, CancellationToken cancellationToken = default);
    Task<bool> TryRemoveAsync(Guid id, CancellationToken cancellationToken = default);
}
