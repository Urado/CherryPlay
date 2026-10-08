using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface ILegalDocumentVersionRepository
{
    Task<IReadOnlyList<LegalDocumentVersionInfo>> ListAsync(CancellationToken cancellationToken = default);
    Task<LegalDocumentVersionInfo?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
}
