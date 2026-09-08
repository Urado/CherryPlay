using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Repositories;

namespace CherryPlayServer.Tests;

internal sealed class LegalConsentInMemoryFixture
{
    public IOrganizersService Organizers { get; }
    public IOAuthAccountsService OAuthAccounts { get; }
    public IConsentEventsService ConsentEvents { get; }
    public ILegalDocumentsService LegalDocuments { get; }

    public LegalConsentInMemoryFixture()
    {
        var versions = new InMemoryLegalDocumentVersionRepository();
        var consentEvents = new InMemoryConsentEventRepository();
        var organizers = new InMemoryOrganizerRepository();
        var emailAccounts = new InMemoryEmailAccountRepository();
        var oauthAccounts = new InMemoryOAuthAccountRepository();
        var passwordHasher = new PasswordHasher();
        var unitOfWork = new InMemoryLegalConsentUnitOfWork(
            organizers,
            emailAccounts,
            oauthAccounts,
            consentEvents,
            versions);

        LegalDocuments = new LegalDocumentsService(versions, consentEvents);
        ConsentEvents = new ConsentEventsService(LegalDocuments, consentEvents, unitOfWork);
        Organizers = new OrganizersService(unitOfWork, LegalDocuments, passwordHasher, ConsentEvents);
        OAuthAccounts = new OAuthAccountsService(unitOfWork, LegalDocuments, ConsentEvents);
    }
}
