using System.Collections.Concurrent;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryLegalDocumentVersionRepository : ILegalDocumentVersionRepository
{
    private const string PdConsentDocumentVersionV1 = "1.0";
    private const string PdConsentHashV1 =
        "1ec5bcae20671f7083e7a3a58525d7d628c7aa1b6b20c0462aea46a09ccd5f6f";
    private const string TermsDocumentVersionV1 = "1.0";
    private const string TermsHashV1 =
        "c9290febb6dce3229775dba33b7a766a09f769963f82331ccd34dc274f32334d";

    private readonly ConcurrentDictionary<Guid, LegalDocumentVersionInfo> _versions = new();

    public InMemoryLegalDocumentVersionRepository()
    {
        Seed(
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            LegalDocumentType.PdConsentText,
            PdConsentDocumentVersionV1,
            PdConsentHashV1,
            LegalDocumentVersionStatus.Active);
        Seed(
            Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            LegalDocumentType.Terms,
            TermsDocumentVersionV1,
            TermsHashV1,
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
