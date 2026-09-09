using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Models;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

public class AccountDeletionServiceTests
{
    private static readonly Guid PdVersionId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TermsVersionId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private const string PdHash = "4fb5ee6b4636828a5f72c3b1091721e02c53c93160db5449e80348f24e0f84bc";
    private const string TermsHash = "63446e6df641cb350ba24e197390c03f76ded704bfe12e692eeeb62c84e14b44";

    [Test]
    public async Task DeleteAccountAsync_ScrubsCredentials_SoftDeletes_KeepsParty_BlocksLogin_AndWithdraws()
    {
        var harness = new AccountDeletionHarness();
        var email = "delete-me@example.com";
        var password = "password1";

        var registered = await harness.OrganizersService.RegisterAsync(new RegisterOrganizerRequest(
            email,
            password,
            "Live Organizer",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));

        var partyId = Guid.NewGuid();
        await harness.Parties.AddAsync(new Party
        {
            Id = partyId,
            OrganizerId = registered.Id,
            Name = "Keep me",
            ShortCode = "keep01",
            CreatedAt = DateTime.UtcNow,
        });

        await harness.Sessions.AddAsync(new OrganizerSession
        {
            Id = Guid.NewGuid(),
            OrganizerId = registered.Id,
            CreatedAt = DateTime.UtcNow,
        });

        await harness.OrganizerService.DeleteAccountAsync(registered.Id);

        Assert.That(await harness.OrganizerRepository.GetByIdAsync(registered.Id), Is.Null);

        var anonymized = await harness.OrganizerRepository.GetByIdAsync(registered.Id, includeDeleted: true);
        Assert.That(anonymized, Is.Not.Null);
        Assert.That(anonymized!.Name, Is.EqualTo(OrganizerDisplayNames.Deleted));
        Assert.That(anonymized.LogoUrl, Is.Null);
        Assert.That(anonymized.Links, Is.Null);

        var keptParty = await harness.Parties.GetByIdAsync(partyId);
        Assert.That(keptParty, Is.Not.Null);
        Assert.That(keptParty!.Name, Is.EqualTo("Keep me"));

        Assert.That(harness.Sessions.CountByOrganizerId(registered.Id), Is.EqualTo(0));

        var login = await harness.Auth.LoginAsync(email, password, issueToken: false);
        Assert.That(login.Success, Is.False);

        Assert.That(await harness.EmailAccounts.GetByEmailAsync(email), Is.Null);
        Assert.That(await harness.EmailAccounts.GetByOrganizerIdAsync(registered.Id), Is.Null);

        var consentEvents = await harness.ConsentEvents.ListAsync(registered.Id);
        Assert.That(consentEvents.Count(e => e.Decision == ConsentDecision.Withdraw), Is.EqualTo(2));
        Assert.That(OrganizerDisplayNames.Resolve(null), Is.EqualTo(OrganizerDisplayNames.Deleted));
    }

    [Test]
    public async Task InMemoryAppUnitOfWork_Rollback_RestoresSessionsAndOrganizer()
    {
        var organizers = new InMemoryOrganizerRepository();
        var emails = new InMemoryEmailAccountRepository();
        var oauth = new InMemoryOAuthAccountRepository();
        var sessions = new InMemoryOrganizerSessionRepository();
        var uow = new InMemoryAppUnitOfWork(organizers, emails, oauth, sessions);

        var organizer = new Organizer
        {
            Id = Guid.NewGuid(),
            Name = "Keep Name",
            CreatedAt = DateTime.UtcNow,
        };
        await organizers.AddAsync(organizer);
        await sessions.AddAsync(new OrganizerSession
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            CreatedAt = DateTime.UtcNow,
        });

        await uow.BeginTransactionAsync();
        var locked = await organizers.GetByIdForUpdateAsync(organizer.Id);
        locked!.Name = OrganizerDisplayNames.Deleted;
        await organizers.UpdateAsync(locked);
        await sessions.RemoveAllByOrganizerIdAsync(organizer.Id);
        await organizers.DeleteAsync(organizer.Id);
        await uow.RollbackAsync();

        Assert.That(sessions.CountByOrganizerId(organizer.Id), Is.EqualTo(1));
        Assert.That((await organizers.GetByIdAsync(organizer.Id))!.Name, Is.EqualTo("Keep Name"));
    }

    private sealed class AccountDeletionHarness
    {
        public InMemoryOrganizerRepository OrganizerRepository { get; } = new();
        public InMemoryEmailAccountRepository EmailAccounts { get; } = new();
        public InMemoryOAuthAccountRepository OAuthAccounts { get; } = new();
        public InMemoryOrganizerSessionRepository Sessions { get; } = new();
        public InMemoryPartyRepository Parties { get; } = new();
        public IConsentEventsService ConsentEvents { get; }
        public OrganizersService OrganizersService { get; }
        public IOrganizerService OrganizerService { get; }
        public AuthService Auth { get; }

        public AccountDeletionHarness()
        {
            var versions = new InMemoryLegalDocumentVersionRepository();
            var consentEvents = new InMemoryConsentEventRepository();
            var passwordHasher = new PasswordHasher();
            var unitOfWork = new InMemoryLegalConsentUnitOfWork(
                OrganizerRepository,
                EmailAccounts,
                OAuthAccounts,
                consentEvents,
                versions);

            var legalDocuments = new LegalDocumentsService(versions, consentEvents);
            ConsentEvents = new ConsentEventsService(legalDocuments, consentEvents, unitOfWork);
            OrganizersService = new OrganizersService(unitOfWork, legalDocuments, passwordHasher, ConsentEvents);
            OrganizerService = new OrganizerService(
                OrganizerRepository,
                new InMemoryAppUnitOfWork(
                    OrganizerRepository,
                    EmailAccounts,
                    OAuthAccounts,
                    Sessions),
                ConsentEvents,
                NullLogger<OrganizerService>.Instance);

            Auth = new AuthService(
                OrganizerRepository,
                Sessions,
                OAuthAccounts,
                EmailAccounts,
                new TestPasswordResetTokenRepository(),
                new InMemoryPasswordResetApplicator(
                    new TestPasswordResetTokenRepository(),
                    EmailAccounts,
                    Sessions),
                passwordHasher,
                new UnusedOAuthService(),
                new UnusedJwtService(),
                new RecordingEmailSender(isConfigured: false),
                Microsoft.Extensions.Options.Options.Create(new Core.Options.EmailOptions()),
                new FakeHostEnvironment("Development"),
                NullLogger<AuthService>.Instance);
        }
    }
}

