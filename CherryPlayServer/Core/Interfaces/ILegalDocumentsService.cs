using CherryPlayServer.Core.Models;
using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface ILegalDocumentsService
{
    Task<IReadOnlyList<LegalDocumentVersionInfo>> GetRequiredActiveAsync(CancellationToken cancellationToken = default);
    Task EnsureActiveConsentAsync(Guid legalDocumentVersionId, string documentHash, CancellationToken cancellationToken = default);
    Task EnsureRequiredActiveGrantsAsync(IReadOnlyList<ConsentInputDto> consents, CancellationToken cancellationToken = default);
    Task<bool> HasGrantAsync(Guid subjectId, Guid legalDocumentVersionId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Guid>> GetMissingRequiredGrantsAsync(Guid subjectId, CancellationToken cancellationToken = default);
}
