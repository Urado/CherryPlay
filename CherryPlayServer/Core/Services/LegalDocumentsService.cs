using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Services;

public class LegalDocumentsService : ILegalDocumentsService
{
    private static readonly HashSet<LegalDocumentType> RequiredTypes =
    [
        LegalDocumentType.PdConsentText,
        LegalDocumentType.Terms
    ];

    private readonly ILegalDocumentVersionRepository _documentVersions;
    private readonly IConsentEventRepository _consentEvents;

    public LegalDocumentsService(
        ILegalDocumentVersionRepository documentVersions,
        IConsentEventRepository consentEvents)
    {
        _documentVersions = documentVersions ?? throw new ArgumentNullException(nameof(documentVersions));
        _consentEvents = consentEvents ?? throw new ArgumentNullException(nameof(consentEvents));
    }

    public async Task<IReadOnlyList<LegalDocumentVersionInfo>> GetRequiredActiveAsync(
        CancellationToken cancellationToken = default)
    {
        var all = await _documentVersions.ListAsync(cancellationToken);
        return all
            .Where(v => v.Status == LegalDocumentVersionStatus.Active && RequiredTypes.Contains(v.DocumentType))
            .ToList();
    }

    public async Task EnsureActiveConsentAsync(
        Guid legalDocumentVersionId,
        string documentHash,
        CancellationToken cancellationToken = default)
    {
        var version = await _documentVersions.GetByIdAsync(legalDocumentVersionId, cancellationToken);
        if (version is null
            || version.Status != LegalDocumentVersionStatus.Active
            || !string.Equals(version.ContentHash, documentHash, StringComparison.Ordinal))
        {
            throw new LegalConsentException(LegalConsentFailureKind.Validation, "Invalid consent document.");
        }
    }

    public async Task EnsureRequiredActiveGrantsAsync(
        IReadOnlyList<ConsentInputDto> consents,
        CancellationToken cancellationToken = default)
    {
        if (consents is null || consents.Count == 0)
        {
            throw new LegalConsentException(LegalConsentFailureKind.Validation, "Consents are required.");
        }

        foreach (var consent in consents)
        {
            await EnsureActiveConsentAsync(consent.LegalDocumentVersionId, consent.DocumentHash, cancellationToken);
        }

        var required = await GetRequiredActiveAsync(cancellationToken);
        foreach (var req in required)
        {
            var covered = consents.Any(c =>
                c.Decision == ConsentDecision.Grant
                && c.LegalDocumentVersionId == req.Id
                && string.Equals(c.DocumentHash, req.ContentHash, StringComparison.Ordinal));
            if (!covered)
            {
                throw new LegalConsentException(LegalConsentFailureKind.Validation, "Required consents are incomplete.");
            }
        }
    }

    public async Task<bool> HasGrantAsync(
        Guid subjectId,
        Guid legalDocumentVersionId,
        CancellationToken cancellationToken = default)
    {
        var events = await _consentEvents.ListBySubjectAsync(subjectId, cancellationToken);
        var latest = events
            .Where(e => e.LegalDocumentVersionId == legalDocumentVersionId)
            .OrderByDescending(e => e.EventAt)
            .FirstOrDefault();

        return latest is not null && latest.Decision == ConsentDecision.Grant;
    }

    public async Task<IReadOnlyList<Guid>> GetMissingRequiredGrantsAsync(
        Guid subjectId,
        CancellationToken cancellationToken = default)
    {
        var required = await GetRequiredActiveAsync(cancellationToken);
        if (required.Count == 0)
        {
            return [];
        }

        var events = await _consentEvents.ListBySubjectAsync(subjectId, cancellationToken);
        var grantedVersionIds = events
            .GroupBy(e => e.LegalDocumentVersionId)
            .Where(g =>
            {
                var latest = g.OrderByDescending(e => e.EventAt).First();
                return latest.Decision == ConsentDecision.Grant;
            })
            .Select(g => g.Key)
            .ToHashSet();

        return required
            .Where(v => !grantedVersionIds.Contains(v.Id))
            .Select(v => v.Id)
            .ToList();
    }
}
