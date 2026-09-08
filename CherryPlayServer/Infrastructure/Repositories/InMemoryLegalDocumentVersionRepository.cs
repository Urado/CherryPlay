using System.Collections.Concurrent;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryLegalDocumentVersionRepository : ILegalDocumentVersionRepository
{
    private readonly ConcurrentDictionary<Guid, LegalDocumentVersionInfo> _versions = new();

    public InMemoryLegalDocumentVersionRepository()
    {
        Seed(
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            LegalDocumentType.PdConsentText,
            "v1",
            "pd-consent-hash-v1",
            LegalDocumentVersionStatus.Active);
        Seed(
            Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            LegalDocumentType.Terms,
            "v1",
            "terms-hash-v1",
            LegalDocumentVersionStatus.Active);
        Seed(
            Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            LegalDocumentType.PdConsentText,
            "v0",
            "pd-consent-hash-v1",
            LegalDocumentVersionStatus.Retired);
    }

    public Task<IReadOnlyList<LegalDocumentVersionInfo>> ListAsync(CancellationToken cancellationToken = default)
    {
        IReadOnlyList<LegalDocumentVersionInfo> list = _versions.Values.ToList();
        return Task.FromResult(list);
    }

    public Task<LegalDocumentVersionInfo?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        _versions.TryGetValue(id, out var version);
        return Task.FromResult(version);
    }

    private void Seed(
        Guid id,
        LegalDocumentType documentType,
        string documentVersion,
        string contentHash,
        LegalDocumentVersionStatus status)
    {
        _versions[id] = new LegalDocumentVersionInfo(id, documentType, documentVersion, contentHash, status);
    }
}
