using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace CherryPlayServer.Tests;

internal sealed class LegalConsentInMemoryFixture
{
    private readonly InMemoryOrganizerRepository _organizerRepository;

    public IOrganizersService Organizers { get; }
    public IOAuthAccountsService OAuthAccounts { get; }
    public IConsentEventsService ConsentEvents { get; }
    public ILegalDocumentsService LegalDocuments { get; }
    public int OrganizerCount => _organizerRepository.Count;

    public LegalConsentInMemoryFixture()
    {
        var versions = new InMemoryLegalDocumentVersionRepository();
        var consentEvents = new InMemoryConsentEventRepository();
        _organizerRepository = new InMemoryOrganizerRepository();
        var emailAccounts = new InMemoryEmailAccountRepository();
        var oauthAccounts = new InMemoryOAuthAccountRepository();
        var passwordHasher = new PasswordHasher();
        var unitOfWork = new InMemoryLegalConsentUnitOfWork(
            _organizerRepository,
            emailAccounts,
            oauthAccounts,
            consentEvents,
            versions);

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["OAUTH_REDIRECT_BASE_URL"] = "https://api.test",
            })
            .Build();

        LegalDocuments = new LegalDocumentsService(versions, consentEvents);
        ConsentEvents = new ConsentEventsService(LegalDocuments, consentEvents, unitOfWork);
        Organizers = new OrganizersService(unitOfWork, LegalDocuments, passwordHasher, ConsentEvents);
        OAuthAccounts = new OAuthAccountsService(
            unitOfWork,
            LegalDocuments,
            ConsentEvents,
            new DeterministicFakeOAuthService(),
            new FixedTokenAuthService(),
            configuration,
            new HttpContextAccessor());
    }

    public Task SoftDeleteOrganizerAsync(Guid organizerId) =>
        _organizerRepository.DeleteAsync(organizerId);
}

internal sealed class DeterministicFakeOAuthService : IOAuthService
{
    public Task<string> GetAuthorizationUrlAsync(OAuthProvider provider, string redirectUri, string? state = null) =>
        Task.FromResult($"https://oauth.test/{provider}");

    public Task<OAuthUserInfo> ExchangeCodeAsync(OAuthProvider provider, string code, string redirectUri) =>
        Task.FromResult(new OAuthUserInfo(
            ProviderUserId: $"{provider.ToString().ToLowerInvariant()}:{code}",
            ProviderUserName: $"User {code}",
            ProviderUserAvatarUrl: null));

    public Task<OAuthUserInfo> ExchangeVkIdCodeAsync(string code, string deviceId, string redirectUri) =>
        Task.FromResult(new OAuthUserInfo(
            ProviderUserId: $"vk:{code}",
            ProviderUserName: $"VK {code}",
            ProviderUserAvatarUrl: null));
}

internal sealed class FixedTokenAuthService : IAuthService
{
    public Task<AuthResult> LoginAsync(string email, string password, bool issueToken = true) =>
        throw new NotSupportedException();

    public Task<AuthResult> RegisterAsync(string email, string password, string name, bool issueToken = true) =>
        throw new NotSupportedException();

    public Task<string> GenerateTokenAsync(Organizer organizer) =>
        Task.FromResult($"token:{organizer.Id:N}");

    public Task<Organizer> ProcessOAuthCallbackAsync(
        OAuthProvider provider,
        string code,
        string redirectUri,
        string? deviceId = null) =>
        throw new NotSupportedException();

    public Task<ForgotPasswordResult> ForgotPasswordAsync(string email) =>
        throw new NotSupportedException();

    public Task<PasswordMutationResult> ResetPasswordAsync(string token, string newPassword) =>
        throw new NotSupportedException();

    public Task<PasswordMutationResult> ChangePasswordAsync(
        Guid organizerId,
        string oldPassword,
        string newPassword) =>
        throw new NotSupportedException();
}
