using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Services;

public class OrganizersService : IOrganizersService
{
    private readonly ILegalConsentUnitOfWork _unitOfWork;
    private readonly ILegalDocumentsService _legalDocuments;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IConsentEventsService _consentEvents;

    public OrganizersService(
        ILegalConsentUnitOfWork unitOfWork,
        ILegalDocumentsService legalDocuments,
        IPasswordHasher passwordHasher,
        IConsentEventsService consentEvents)
    {
        _unitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
        _legalDocuments = legalDocuments ?? throw new ArgumentNullException(nameof(legalDocuments));
        _passwordHasher = passwordHasher ?? throw new ArgumentNullException(nameof(passwordHasher));
        _consentEvents = consentEvents ?? throw new ArgumentNullException(nameof(consentEvents));
    }

    public async Task<RegisterOrganizerResponse> RegisterAsync(
        RegisterOrganizerRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        await _legalDocuments.EnsureRequiredActiveGrantsAsync(request.Consents, cancellationToken);

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var existingAccount = await _unitOfWork.EmailAccounts.GetByEmailForUpdateAsync(
                request.Email,
                cancellationToken);

            if (existingAccount is not null)
            {
                if (await _consentEvents.AreIdempotentReplayAsync(
                        existingAccount.OrganizerId,
                        request.Consents,
                        cancellationToken))
                {
                    var existingOrganizer = await _unitOfWork.Organizers.GetByIdAsync(existingAccount.OrganizerId)
                        ?? throw new LegalConsentException(LegalConsentFailureKind.Conflict, "Organizer not found.");
                    var replay = new RegisterOrganizerResponse(
                        existingOrganizer.Id,
                        request.Email,
                        existingOrganizer.Name);
                    await _unitOfWork.CommitAsync(cancellationToken);
                    return replay;
                }

                throw new LegalConsentException(LegalConsentFailureKind.Conflict, "Email is already registered.");
            }

            var organizerId = Guid.NewGuid();
            await _consentEvents.EnsureNoConflictsAsync(organizerId, request.Consents, cancellationToken);

            var organizer = new Organizer
            {
                Id = organizerId,
                Name = request.Name,
                CreatedAt = DateTime.UtcNow
            };
            await _unitOfWork.Organizers.AddAsync(organizer);

            var emailAccount = new EmailAccount
            {
                Id = Guid.NewGuid(),
                OrganizerId = organizer.Id,
                Email = request.Email,
                PasswordHash = _passwordHasher.HashPassword(request.Password),
                CreatedAt = DateTime.UtcNow
            };

            if (!await _unitOfWork.EmailAccounts.TryAddAsync(emailAccount))
            {
                throw new LegalConsentException(
                    LegalConsentFailureKind.Conflict,
                    "Email is already registered.");
            }

            await _consentEvents.AppendAsync(organizer.Id, request.Consents, cancellationToken);
            await _unitOfWork.CommitAsync(cancellationToken);
            return new RegisterOrganizerResponse(organizer.Id, request.Email, organizer.Name);
        }
        catch
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
