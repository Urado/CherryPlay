using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IConsentEventsService
{
    Task<IReadOnlyList<ConsentEventDto>> ListAsync(Guid organizerId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ConsentEventDto>> CreateAsync(
        Guid organizerId,
        CreateConsentEventsRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> AreIdempotentReplayAsync(
        Guid subjectId,
        IReadOnlyList<ConsentInputDto> consents,
        CancellationToken cancellationToken = default);

    Task EnsureNoConflictsAsync(
        Guid subjectId,
        IReadOnlyList<ConsentInputDto> consents,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ConsentEventDto>> AppendAsync(
        Guid subjectId,
        IReadOnlyList<ConsentInputDto> consents,
        CancellationToken cancellationToken = default);
}
