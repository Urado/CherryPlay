using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Services;

public class OAuthAccountsService : IOAuthAccountsService
{
    private readonly ILegalConsentUnitOfWork _unitOfWork;
    private readonly ILegalDocumentsService _legalDocuments;
    private readonly IConsentEventsService _consentEvents;

    public OAuthAccountsService(
        ILegalConsentUnitOfWork unitOfWork,
        ILegalDocumentsService legalDocuments,
        IConsentEventsService consentEvents)
    {
        _unitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
        _legalDocuments = legalDocuments ?? throw new ArgumentNullException(nameof(legalDocuments));
        _consentEvents = consentEvents ?? throw new ArgumentNullException(nameof(consentEvents));
    }

    public async Task<CreateOAuthAccountResponse> CreateAsync(
        CreateOAuthAccountRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (string.IsNullOrWhiteSpace(request.Code))
        {
            throw new LegalConsentException(LegalConsentFailureKind.Validation, "OAuth code is required.");
        }

        await _legalDocuments.EnsureRequiredActiveGrantsAsync(request.Consents, cancellationToken);

        var providerUserId = $"{request.Provider}:{request.Code}";

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var existing = await _unitOfWork.OAuthAccounts.GetByProviderUserIdForUpdateAsync(
                request.Provider,
                providerUserId,
                cancellationToken);

            if (existing is not null)
            {
                if (!await _consentEvents.AreIdempotentReplayAsync(
                        existing.OrganizerId,
                        request.Consents,
                        cancellationToken))
                {
                    throw new LegalConsentException(
                        LegalConsentFailureKind.Conflict,
                        "OAuth account already linked with different consents.");
                }

                var existingOrganizer = await _unitOfWork.Organizers.GetByIdAsync(existing.OrganizerId)
                    ?? throw new LegalConsentException(LegalConsentFailureKind.Conflict, "Organizer not found.");

                var replay = new CreateOAuthAccountResponse(
                    existingOrganizer.Id,
                    BuildOAuthEmail(providerUserId),
                    providerUserId);
                await _unitOfWork.CommitAsync(cancellationToken);
                return replay;
            }

            var organizerId = Guid.NewGuid();
            await _consentEvents.EnsureNoConflictsAsync(organizerId, request.Consents, cancellationToken);

            var organizer = new Organizer
            {
                Id = organizerId,
                Name = $"OAuth {request.Provider}",
                CreatedAt = DateTime.UtcNow
            };
            await _unitOfWork.Organizers.AddAsync(organizer);

            var oauthAccount = new OAuthAccount
            {
                Id = Guid.NewGuid(),
                OrganizerId = organizer.Id,
                Provider = request.Provider,
                ProviderUserId = providerUserId,
                CreatedAt = DateTime.UtcNow
            };

            if (!await _unitOfWork.OAuthAccounts.TryAddAsync(oauthAccount))
            {
                throw new LegalConsentException(
                    LegalConsentFailureKind.Conflict,
                    "OAuth account already linked.");
            }

            await _consentEvents.AppendAsync(organizer.Id, request.Consents, cancellationToken);
            await _unitOfWork.CommitAsync(cancellationToken);

            return new CreateOAuthAccountResponse(
                organizer.Id,
                BuildOAuthEmail(providerUserId),
                providerUserId);
        }
        catch
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static string BuildOAuthEmail(string providerUserId) => $"{providerUserId}@oauth.local";
}
