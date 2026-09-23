using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;

namespace CherryPlayServer.Tests;

public class LegalConsentErrorTests
{
    private IOrganizersService Organizers = null!;
    private IOAuthAccountsService OAuthAccounts = null!;
    private IConsentEventsService ConsentEvents = null!;
    private LegalConsentInMemoryFixture Fixture = null!;

    private static readonly Guid PdVersionId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TermsVersionId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid RetiredVersionId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    private const string PdHash = "1ec5bcae20671f7083e7a3a58525d7d628c7aa1b6b20c0462aea46a09ccd5f6f";
    private const string TermsHash = "c9290febb6dce3229775dba33b7a766a09f769963f82331ccd34dc274f32334d";

    [SetUp]
    public void SetUp()
    {
        Fixture = new LegalConsentInMemoryFixture();
        Organizers = Fixture.Organizers;
        OAuthAccounts = Fixture.OAuthAccounts;
        ConsentEvents = Fixture.ConsentEvents;
    }

    [Test]
    public void ER01_RegisterAsync_EmptyConsents_ThrowsValidation()
    {
        var request = new RegisterOrganizerRequest(
            "er01@example.com",
            "password1",
            "ER01 Organizer",
            []);
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () => await Organizers.RegisterAsync(request));
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
    }

    [Test]
    public void ER02_RegisterAsync_IncompletePack_ThrowsValidation()
    {
        var request = new RegisterOrganizerRequest(
            "er02@example.com",
            "password1",
            "ER02 Organizer",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
            ]);
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () => await Organizers.RegisterAsync(request));
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
    }

    [Test]
    public void ER03_RegisterAsync_HashMismatch_ThrowsValidation()
    {
        var request = new RegisterOrganizerRequest(
            "er03@example.com",
            "password1",
            "ER03 Organizer",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, "wrong-pd-hash", ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]);
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () => await Organizers.RegisterAsync(request));
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
    }

    [Test]
    public void ER04_RegisterAsync_UnknownVersionId_ThrowsValidation()
    {
        var unknownVersionId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var request = new RegisterOrganizerRequest(
            "er04@example.com",
            "password1",
            "ER04 Organizer",
            [
                new ConsentInputDto(Guid.NewGuid(), unknownVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]);
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () => await Organizers.RegisterAsync(request));
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
    }

    [Test]
    public void ER05_RegisterAsync_RetiredVersion_ThrowsValidation()
    {
        var request = new RegisterOrganizerRequest(
            "er05@example.com",
            "password1",
            "ER05 Organizer",
            [
                new ConsentInputDto(Guid.NewGuid(), RetiredVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]);
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () => await Organizers.RegisterAsync(request));
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
    }

    [Test]
    public async Task ER06_RegisterAsync_DuplicateEmail_ThrowsConflict()
    {
        var consents = () => new List<ConsentInputDto>
        {
            new(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
            new(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
        };
        var first = new RegisterOrganizerRequest("dup@example.com", "password1", "First", consents());
        var second = new RegisterOrganizerRequest("dup@example.com", "password1", "Second", consents());
        await Organizers.RegisterAsync(first);
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () => await Organizers.RegisterAsync(second));
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Conflict));
    }

    [Test]
    public void ER07_OAuthCreateAsync_EmptyCode_ThrowsValidation()
    {
        var request = new CreateOAuthAccountRequest(
            OAuthProvider.Vk,
            "",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]);
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () => await OAuthAccounts.CreateAsync(request));
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
    }

    [Test]
    public void ER08_OAuthCreateAsync_IncompleteConsents_ThrowsValidation()
    {
        var request = new CreateOAuthAccountRequest(
            OAuthProvider.Vk,
            "valid-looking-oauth-code",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
            ]);
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () => await OAuthAccounts.CreateAsync(request));
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
        Assert.That(Fixture.OrganizerCount, Is.EqualTo(0));
    }

    [Test]
    public void ER08b_OAuthCreateAsync_NewSubjectEmptyConsents_ThrowsValidation_AndCreatesNoOrganizer()
    {
        var request = new CreateOAuthAccountRequest(
            OAuthProvider.Vk,
            "new-subject-no-consents",
            []);
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () => await OAuthAccounts.CreateAsync(request));
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
        Assert.That(Fixture.OrganizerCount, Is.EqualTo(0));
    }

    [Test]
    public void ER08c_OAuthCreateAsync_NonCanonicalRedirectUri_ThrowsValidation()
    {
        var request = new CreateOAuthAccountRequest(
            OAuthProvider.Vk,
            "code-with-bad-redirect",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ],
            RedirectUri: "https://evil.example/callback");

        var ex = Assert.ThrowsAsync<LegalConsentException>(async () => await OAuthAccounts.CreateAsync(request));

        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
        Assert.That(ex.Message, Does.Contain("RedirectUri"));
        Assert.That(Fixture.OrganizerCount, Is.EqualTo(0));
    }

    [Test]
    public async Task ER08d_OAuthCreateAsync_SoftDeletedOrganizer_ThrowsValidation()
    {
        var created = await OAuthAccounts.CreateAsync(new CreateOAuthAccountRequest(
            OAuthProvider.Vk,
            "deleted-organizer-oauth",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));

        await Fixture.SoftDeleteOrganizerAsync(created.Id);

        var ex = Assert.ThrowsAsync<LegalConsentException>(async () =>
            await OAuthAccounts.CreateAsync(new CreateOAuthAccountRequest(
                OAuthProvider.Vk,
                "deleted-organizer-oauth",
                [])));

        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
        Assert.That(ex.Message, Does.Contain("deleted"));
    }

    [Test]
    public async Task ER08e_OAuthCreateAsync_CanonicalRedirectUri_Accepted()
    {
        var response = await OAuthAccounts.CreateAsync(new CreateOAuthAccountRequest(
            OAuthProvider.Vk,
            "canonical-redirect-ok",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ],
            RedirectUri: "https://api.test/auth/vk/callback"));

        Assert.That(response.Id, Is.Not.EqualTo(Guid.Empty));
        Assert.That(response.ProviderSubject, Is.EqualTo("vk:canonical-redirect-ok"));
    }

    [Test]
    public async Task ER11_CreateAsync_MixedGoodAndBadHash_ThrowsValidation_AndListUnchanged()
    {
        var grantPdId = Guid.Parse("e1111111-1111-1111-1111-111111111111");
        var grantTermsId = Guid.Parse("e2222222-2222-2222-2222-222222222222");
        var registered = await Organizers.RegisterAsync(new RegisterOrganizerRequest(
            "er11@example.com",
            "password1",
            "ER11 Organizer",
            [
                new ConsentInputDto(grantPdId, PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(grantTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));
        var before = await ConsentEvents.ListAsync(registered.Id);
        var beforeIds = before.Select(e => e.Id).ToList();
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () =>
            await ConsentEvents.CreateAsync(
                registered.Id,
                new CreateConsentEventsRequest(
                [
                    new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
                    new ConsentInputDto(Guid.NewGuid(), TermsVersionId, "bad-terms-hash", ConsentDecision.Grant),
                ])));
        var after = await ConsentEvents.ListAsync(registered.Id);
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
        Assert.That(after.Select(e => e.Id), Is.EquivalentTo(beforeIds));
    }

    [Test]
    public async Task ER12_ListAsync_AfterTwoRegisters_DoesNotLeakOtherOrganizerEvents()
    {
        var aPdId = Guid.Parse("a1111111-1111-1111-1111-111111111111");
        var aTermsId = Guid.Parse("a2222222-2222-2222-2222-222222222222");
        var bPdId = Guid.Parse("b1111111-1111-1111-1111-111111111111");
        var bTermsId = Guid.Parse("b2222222-2222-2222-2222-222222222222");
        var organizerA = await Organizers.RegisterAsync(new RegisterOrganizerRequest(
            "er12a@example.com",
            "password1",
            "Organizer A",
            [
                new ConsentInputDto(aPdId, PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(aTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));
        await Organizers.RegisterAsync(new RegisterOrganizerRequest(
            "er12b@example.com",
            "password1",
            "Organizer B",
            [
                new ConsentInputDto(bPdId, PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(bTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));
        var eventsA = await ConsentEvents.ListAsync(organizerA.Id);
        Assert.That(eventsA.Select(e => e.Id), Is.EquivalentTo(new[] { aPdId, aTermsId }));
        Assert.That(eventsA.Select(e => e.Id), Does.Not.Contain(bPdId));
        Assert.That(eventsA.Select(e => e.Id), Does.Not.Contain(bTermsId));
    }
}
