using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Services;

public class OAuthAccountsService : IOAuthAccountsService
{
    private readonly ILegalConsentUnitOfWork _unitOfWork;
    private readonly ILegalDocumentsService _legalDocuments;
    private readonly IConsentEventsService _consentEvents;
    private readonly IOAuthService _oauthService;
    private readonly IAuthService _authService;
    private readonly IConfiguration _configuration;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public OAuthAccountsService(
        ILegalConsentUnitOfWork unitOfWork,
        ILegalDocumentsService legalDocuments,
        IConsentEventsService consentEvents,
        IOAuthService oauthService,
        IAuthService authService,
        IConfiguration configuration,
        IHttpContextAccessor httpContextAccessor)
    {
        _unitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
        _legalDocuments = legalDocuments ?? throw new ArgumentNullException(nameof(legalDocuments));
        _consentEvents = consentEvents ?? throw new ArgumentNullException(nameof(consentEvents));
        _oauthService = oauthService ?? throw new ArgumentNullException(nameof(oauthService));
        _authService = authService ?? throw new ArgumentNullException(nameof(authService));
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
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

        var consents = request.Consents ?? [];
        if (consents.Count > 0)
        {
            await _legalDocuments.EnsureRequiredActiveGrantsAsync(consents, cancellationToken);
        }

        var redirectUri = OAuthRedirectUri.ResolveForExchange(
            request.Provider.ToString(),
            request.RedirectUri,
            _configuration,
            _httpContextAccessor.HttpContext?.Request);

        var userInfo = await ExchangeAsync(request, redirectUri);

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var existing = await _unitOfWork.OAuthAccounts.GetByProviderUserIdForUpdateAsync(
                request.Provider,
                userInfo.ProviderUserId,
                cancellationToken);

            if (existing is not null)
            {
                var existingOrganizer = await _unitOfWork.Organizers.GetByIdAsync(existing.OrganizerId);
                if (existingOrganizer is null)
                {
                    var deletedOrMissing = await _unitOfWork.Organizers.GetByIdAsync(
                        existing.OrganizerId,
                        includeDeleted: true);
                    throw new LegalConsentException(
                        LegalConsentFailureKind.Validation,
                        deletedOrMissing is not null
                            ? "This account has been deleted."
                            : "Organizer not found for this OAuth account.");
                }

                existing.LastUsedAt = DateTime.UtcNow;
                existing.ProviderUserName = userInfo.ProviderUserName;
                existing.ProviderUserAvatarUrl = userInfo.ProviderUserAvatarUrl;
                await _unitOfWork.OAuthAccounts.UpdateAsync(existing);

                await _unitOfWork.CommitAsync(cancellationToken);
                return await BuildResponseAsync(existingOrganizer, userInfo.ProviderUserId);
            }

            await _legalDocuments.EnsureRequiredActiveGrantsAsync(consents, cancellationToken);

            var organizerId = Guid.NewGuid();
            await _consentEvents.EnsureNoConflictsAsync(organizerId, consents, cancellationToken);

            var organizer = new Organizer
            {
                Id = organizerId,
                Name = userInfo.ProviderUserName ?? $"User from {request.Provider}",
                CreatedAt = DateTime.UtcNow
            };
            await _unitOfWork.Organizers.AddAsync(organizer);

            var oauthAccount = new OAuthAccount
            {
                Id = Guid.NewGuid(),
                OrganizerId = organizer.Id,
                Provider = request.Provider,
                ProviderUserId = userInfo.ProviderUserId,
                ProviderUserName = userInfo.ProviderUserName,
                ProviderUserAvatarUrl = userInfo.ProviderUserAvatarUrl,
                CreatedAt = DateTime.UtcNow,
                LastUsedAt = DateTime.UtcNow
            };

            if (!await _unitOfWork.OAuthAccounts.TryAddAsync(oauthAccount))
            {
                throw new LegalConsentException(
                    LegalConsentFailureKind.Conflict,
                    "OAuth account already linked.");
            }

            await _consentEvents.AppendAsync(organizer.Id, consents, cancellationToken);
            await _unitOfWork.CommitAsync(cancellationToken);

            return await BuildResponseAsync(organizer, userInfo.ProviderUserId);
        }
        catch
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task<OAuthUserInfo> ExchangeAsync(CreateOAuthAccountRequest request, string redirectUri)
    {
        if (request.Provider == OAuthProvider.Vk && !string.IsNullOrWhiteSpace(request.DeviceId))
        {
            return await _oauthService.ExchangeVkIdCodeAsync(request.Code, request.DeviceId, redirectUri);
        }

        return await _oauthService.ExchangeCodeAsync(request.Provider, request.Code, redirectUri);
    }

    private async Task<CreateOAuthAccountResponse> BuildResponseAsync(Organizer organizer, string providerUserId)
    {
        var accessToken = await _authService.GenerateTokenAsync(organizer);
        return new CreateOAuthAccountResponse(
            organizer.Id,
            BuildOAuthEmail(providerUserId),
            providerUserId,
            accessToken);
    }

    private static string BuildOAuthEmail(string providerUserId) => $"{providerUserId}@oauth.local";
}
