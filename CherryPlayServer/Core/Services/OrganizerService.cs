using CherryPlayServer.Core;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Mappings;
using CherryPlayServer.Models;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Core.Services;

public class OrganizerService : IOrganizerService
{
    private readonly IOrganizerRepository _organizers;
    private readonly IAppUnitOfWork _unitOfWork;
    private readonly IConsentEventsService _consentEvents;
    private readonly ILogger<OrganizerService> _logger;

    public OrganizerService(
        IOrganizerRepository organizers,
        IAppUnitOfWork unitOfWork,
        IConsentEventsService consentEvents,
        ILogger<OrganizerService> logger)
    {
        _organizers = organizers ?? throw new ArgumentNullException(nameof(organizers));
        _unitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
        _consentEvents = consentEvents ?? throw new ArgumentNullException(nameof(consentEvents));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<OrganizerDto?> GetByIdAsync(Guid organizerId)
    {
        var organizer = await _organizers.GetByIdAsync(organizerId);
        return organizer == null ? null : OrganizerMapper.ToDto(organizer);
    }

    public async Task<OrganizerDto?> UpdateProfileAsync(Guid organizerId, UpdateOrganizerDto dto)
    {
        if (dto == null)
        {
            throw new ArgumentNullException(nameof(dto));
        }

        var organizer = await _organizers.GetByIdAsync(organizerId);
        if (organizer == null)
        {
            return null;
        }

        if (!string.IsNullOrEmpty(dto.Name))
        {
            organizer.Name = dto.Name;
        }

        if (dto.LogoUrl != null)
        {
            organizer.LogoUrl = dto.LogoUrl;
        }

        if (dto.Links != null)
        {
            organizer.Links = dto.Links;
        }

        if (dto.TimeZone != null)
        {
            organizer.TimeZone = dto.TimeZone;
        }

        organizer.UpdatedAt = DateTime.UtcNow;
        await _organizers.UpdateAsync(organizer);

        return OrganizerMapper.ToDto(organizer);
    }

    public async Task DeleteAccountAsync(Guid organizerId, CancellationToken cancellationToken = default)
    {
        await TryWithdrawConsentsAsync(organizerId, cancellationToken);

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var organizer = await _unitOfWork.Organizers.GetByIdForUpdateAsync(organizerId, cancellationToken);
            if (organizer is null)
            {
                await _unitOfWork.RollbackAsync(cancellationToken);
                _logger.LogInformation(
                    "Account delete skipped; organizer {OrganizerId} not found or already deleted",
                    organizerId);
                return;
            }

            await _unitOfWork.Sessions.RemoveAllByOrganizerIdAsync(organizerId);

            var email = await _unitOfWork.EmailAccounts.GetByOrganizerIdAsync(organizerId);
            if (email is not null)
            {
                await _unitOfWork.EmailAccounts.DeleteAsync(email.Id);
            }

            foreach (var oauth in await _unitOfWork.OAuthAccounts.GetByOrganizerIdAsync(organizerId))
            {
                await _unitOfWork.OAuthAccounts.DeleteAsync(oauth.Id);
            }

            organizer.Name = OrganizerDisplayNames.Deleted;
            organizer.LogoUrl = null;
            organizer.Links = null;
            organizer.UpdatedAt = DateTime.UtcNow;
            await _unitOfWork.Organizers.UpdateAsync(organizer);
            await _unitOfWork.Organizers.DeleteAsync(organizerId);

            await _unitOfWork.CommitAsync(cancellationToken);
            _logger.LogInformation("Organizer account {OrganizerId} soft-deleted and scrubbed", organizerId);
        }
        catch
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task TryWithdrawConsentsAsync(Guid organizerId, CancellationToken cancellationToken)
    {
        try
        {
            var events = await _consentEvents.ListAsync(organizerId, cancellationToken);
            var activeGrants = events
                .OrderBy(e => e.EventAt)
                .GroupBy(e => e.LegalDocumentVersionId)
                .Select(g => g.Last())
                .Where(e => e.Decision == ConsentDecision.Grant)
                .ToList();

            if (activeGrants.Count == 0)
            {
                return;
            }

            var withdrawInputs = activeGrants
                .Select(g => new ConsentInputDto(
                    Guid.NewGuid(),
                    g.LegalDocumentVersionId,
                    g.DocumentHash,
                    ConsentDecision.Withdraw))
                .ToList();

            await _consentEvents.CreateAsync(
                organizerId,
                new CreateConsentEventsRequest(withdrawInputs),
                cancellationToken);
        }
        catch (Exception ex) when (ex is InvalidOperationException or NotSupportedException)
        {
            _logger.LogWarning(
                ex,
                "Consent withdraw skipped for organizer {OrganizerId} (consent store unavailable)",
                organizerId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Consent withdraw failed for organizer {OrganizerId}; continuing account deletion",
                organizerId);
        }
    }
}
