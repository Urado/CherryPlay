using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Services;

public class ConsentEventsService : IConsentEventsService
{
    private readonly ILegalDocumentsService _legalDocuments;
    private readonly IConsentEventRepository _consentEvents;
    private readonly ILegalConsentUnitOfWork _unitOfWork;

    public ConsentEventsService(
        ILegalDocumentsService legalDocuments,
        IConsentEventRepository consentEvents,
        ILegalConsentUnitOfWork unitOfWork)
    {
        _legalDocuments = legalDocuments ?? throw new ArgumentNullException(nameof(legalDocuments));
        _consentEvents = consentEvents ?? throw new ArgumentNullException(nameof(consentEvents));
        _unitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
    }

    public async Task<IReadOnlyList<ConsentEventDto>> ListAsync(
        Guid organizerId,
        CancellationToken cancellationToken = default)
    {
        var events = await _consentEvents.ListBySubjectAsync(organizerId, cancellationToken);
        return events.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<ConsentEventDto>> CreateAsync(
        Guid organizerId,
        CreateConsentEventsRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request?.Events is null || request.Events.Count == 0)
        {
            throw new LegalConsentException(LegalConsentFailureKind.Validation, "Consents are required.");
        }

        foreach (var consent in request.Events)
        {
            await _legalDocuments.EnsureActiveConsentAsync(
                consent.LegalDocumentVersionId,
                consent.DocumentHash,
                cancellationToken);
        }

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            await EnsureNoConflictsAsync(organizerId, request.Events, cancellationToken);
            var result = await AppendAsync(organizerId, request.Events, cancellationToken);
            await _unitOfWork.CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<bool> AreIdempotentReplayAsync(
        Guid subjectId,
        IReadOnlyList<ConsentInputDto> consents,
        CancellationToken cancellationToken = default)
    {
        foreach (var consent in consents)
        {
            var existing = await _consentEvents.GetByIdAsync(consent.Id, cancellationToken);
            if (existing is null || !IsSamePayload(existing, subjectId, consent))
            {
                return false;
            }
        }

        return true;
    }

    public async Task EnsureNoConflictsAsync(
        Guid subjectId,
        IReadOnlyList<ConsentInputDto> consents,
        CancellationToken cancellationToken = default)
    {
        foreach (var consent in consents)
        {
            var existing = await _consentEvents.GetByIdAsync(consent.Id, cancellationToken);
            if (existing is not null && !IsSamePayload(existing, subjectId, consent))
            {
                throw new LegalConsentException(
                    LegalConsentFailureKind.Conflict,
                    "Consent event id conflict.");
            }
        }
    }

    public async Task<IReadOnlyList<ConsentEventDto>> AppendAsync(
        Guid subjectId,
        IReadOnlyList<ConsentInputDto> consents,
        CancellationToken cancellationToken = default)
    {
        var results = new ConsentEventDto?[consents.Count];
        var toAdd = new List<ConsentEvent>();
        var toAddIndexes = new List<int>();

        for (var i = 0; i < consents.Count; i++)
        {
            var consent = consents[i];
            var existing = await _unitOfWork.ConsentEvents.GetByIdAsync(consent.Id, cancellationToken);
            if (existing is not null)
            {
                if (!IsSamePayload(existing, subjectId, consent))
                {
                    throw new LegalConsentException(
                        LegalConsentFailureKind.Conflict,
                        "Consent event id conflict.");
                }

                results[i] = ToDto(existing);
                continue;
            }

            var entity = new ConsentEvent
            {
                Id = consent.Id,
                SubjectId = subjectId,
                LegalDocumentVersionId = consent.LegalDocumentVersionId,
                DocumentHash = consent.DocumentHash,
                Decision = consent.Decision,
                EventAt = DateTimeOffset.UtcNow
            };
            toAdd.Add(entity);
            toAddIndexes.Add(i);
        }

        if (toAdd.Count == 0)
        {
            return results.Select(r => r!).ToList();
        }

        if (await _unitOfWork.ConsentEvents.TryAddBatchAsync(toAdd, cancellationToken))
        {
            for (var i = 0; i < toAdd.Count; i++)
            {
                results[toAddIndexes[i]] = ToDto(toAdd[i]);
            }

            return results.Select(r => r!).ToList();
        }

        for (var i = 0; i < toAdd.Count; i++)
        {
            var entity = toAdd[i];
            var consent = consents[toAddIndexes[i]];
            var raced = await _unitOfWork.ConsentEvents.GetByIdAsync(entity.Id, cancellationToken)
                ?? throw new LegalConsentException(
                    LegalConsentFailureKind.Conflict,
                    "Consent event id conflict.");
            if (!IsSamePayload(raced, subjectId, consent))
            {
                throw new LegalConsentException(
                    LegalConsentFailureKind.Conflict,
                    "Consent event id conflict.");
            }

            results[toAddIndexes[i]] = ToDto(raced);
        }

        return results.Select(r => r!).ToList();
    }

    private static bool IsSamePayload(ConsentEvent existing, Guid subjectId, ConsentInputDto consent)
    {
        return existing.SubjectId == subjectId
            && existing.LegalDocumentVersionId == consent.LegalDocumentVersionId
            && string.Equals(existing.DocumentHash, consent.DocumentHash, StringComparison.Ordinal)
            && existing.Decision == consent.Decision;
    }

    private static ConsentEventDto ToDto(ConsentEvent entity)
    {
        return new ConsentEventDto(
            entity.Id,
            entity.LegalDocumentVersionId,
            entity.DocumentHash,
            entity.Decision,
            entity.EventAt);
    }
}
