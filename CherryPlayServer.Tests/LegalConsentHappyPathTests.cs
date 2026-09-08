using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;

namespace CherryPlayServer.Tests;

public class LegalConsentHappyPathTests
{
    private IOrganizersService Organizers = null!;
    private IOAuthAccountsService OAuthAccounts = null!;
    private IConsentEventsService ConsentEvents = null!;

    private static readonly Guid PdVersionId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TermsVersionId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private const string PdHash = "pd-consent-hash-v1";
    private const string TermsHash = "terms-hash-v1";

    [SetUp]
    public void SetUp()
    {
        var fixture = new LegalConsentInMemoryFixture();
        Organizers = fixture.Organizers;
        OAuthAccounts = fixture.OAuthAccounts;
        ConsentEvents = fixture.ConsentEvents;
    }

    [Test]
    public async Task HP02_RegisterAsync_ValidRequiredConsents_ReturnsOrganizer_AndListShowsTwoGrants()
    {
        // Arrange
        var grantPdId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var grantTermsId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var request = new RegisterOrganizerRequest(
            "new@example.com",
            "password1",
            "New Organizer",
            [
                new ConsentInputDto(grantPdId, PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(grantTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]);

        // Act
        var response = await Organizers.RegisterAsync(request);

        // Assert
        var events = await ConsentEvents.ListAsync(response.Id);
        Assert.That(response.Id, Is.Not.EqualTo(Guid.Empty));
        Assert.That(response.Email, Is.EqualTo("new@example.com"));
        Assert.That(response.Name, Is.EqualTo("New Organizer"));
        Assert.That(events, Has.Count.EqualTo(2));
        Assert.That(events.Select(e => e.Id), Is.EquivalentTo(new[] { grantPdId, grantTermsId }));
        Assert.That(events.All(e => e.Decision == ConsentDecision.Grant), Is.True);
        Assert.That(
            events.Select(e => (e.LegalDocumentVersionId, e.DocumentHash)),
            Is.EquivalentTo(new[]
            {
                (PdVersionId, PdHash),
                (TermsVersionId, TermsHash),
            }));
    }

    [Test]
    public async Task HP03_CreateAsync_ValidOAuthCodeAndConsents_ReturnsAccount_AndListShowsTwoGrants()
    {
        // Arrange
        var grantPdId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var grantTermsId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        var request = new CreateOAuthAccountRequest(
            OAuthProvider.Vk,
            "valid-oauth-code",
            [
                new ConsentInputDto(grantPdId, PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(grantTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]);

        // Act
        var response = await OAuthAccounts.CreateAsync(request);

        // Assert
        var events = await ConsentEvents.ListAsync(response.Id);
        Assert.That(response.Id, Is.Not.EqualTo(Guid.Empty));
        Assert.That(events, Has.Count.EqualTo(2));
        Assert.That(events.All(e => e.Decision == ConsentDecision.Grant), Is.True);
        Assert.That(events.Select(e => e.Id), Is.EquivalentTo(new[] { grantPdId, grantTermsId }));
    }

    [Test]
    public async Task HP04_CreateAsync_ReconsentPack_AppendsGrants_AndListShowsThem()
    {
        // Arrange
        var organizerId = Guid.Parse("55555555-5555-5555-5555-555555555555");
        var grantPdId = Guid.Parse("66666666-6666-6666-6666-666666666666");
        var grantTermsId = Guid.Parse("77777777-7777-7777-7777-777777777777");
        var request = new CreateConsentEventsRequest(
        [
            new ConsentInputDto(grantPdId, PdVersionId, PdHash, ConsentDecision.Grant),
            new ConsentInputDto(grantTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
        ]);

        // Act
        var created = await ConsentEvents.CreateAsync(organizerId, request);

        // Assert
        var listed = await ConsentEvents.ListAsync(organizerId);
        Assert.That(created, Has.Count.EqualTo(2));
        Assert.That(listed.Select(e => e.Id), Is.SupersetOf(new[] { grantPdId, grantTermsId }));
        Assert.That(
            listed.Where(e => e.Id == grantPdId || e.Id == grantTermsId).All(e => e.Decision == ConsentDecision.Grant),
            Is.True);
    }

    [Test]
    public async Task HP05_ListAsync_AfterRegister_ReturnsOwnEventsWithExpectedFields()
    {
        // Arrange
        var grantPdId = Guid.Parse("88888888-8888-8888-8888-888888888888");
        var grantTermsId = Guid.Parse("99999999-9999-9999-9999-999999999999");
        var response = await Organizers.RegisterAsync(new RegisterOrganizerRequest(
            "list@example.com",
            "password1",
            "Lister",
            [
                new ConsentInputDto(grantPdId, PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(grantTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));

        // Act
        var events = await ConsentEvents.ListAsync(response.Id);

        // Assert
        Assert.That(events, Has.Count.EqualTo(2));
        foreach (var e in events)
        {
            Assert.That(e.EventAt, Is.Not.EqualTo(default(DateTimeOffset)));
            Assert.That(e.DocumentHash, Is.Not.Empty);
            Assert.That(e.LegalDocumentVersionId, Is.AnyOf(PdVersionId, TermsVersionId));
            Assert.That(e.Decision, Is.EqualTo(ConsentDecision.Grant));
        }
    }

    [Test]
    public async Task HP06_CreateAsync_Withdraw_AppendsWithdraw_AndLatestDecisionIsWithdraw()
    {
        // Arrange
        var registered = await Organizers.RegisterAsync(new RegisterOrganizerRequest(
            "withdraw@example.com",
            "password1",
            "Withdrawer",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));
        var withdrawPdId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        var withdrawTermsId = Guid.Parse("ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee");
        var request = new CreateConsentEventsRequest(
        [
            new ConsentInputDto(withdrawPdId, PdVersionId, PdHash, ConsentDecision.Withdraw),
            new ConsentInputDto(withdrawTermsId, TermsVersionId, TermsHash, ConsentDecision.Withdraw),
        ]);

        // Act
        await ConsentEvents.CreateAsync(registered.Id, request);

        // Assert
        var events = await ConsentEvents.ListAsync(registered.Id);
        Assert.That(events.Any(e => e.Id == withdrawPdId && e.Decision == ConsentDecision.Withdraw), Is.True);
        Assert.That(events.Any(e => e.Id == withdrawTermsId && e.Decision == ConsentDecision.Withdraw), Is.True);
        Assert.That(events.Count(e => e.Decision == ConsentDecision.Grant), Is.EqualTo(2));
    }

    [Test]
    public async Task HP08_CreateAsync_Deny_AppendsDeny_WithoutRemovingPriorHistory()
    {
        // Arrange
        var registered = await Organizers.RegisterAsync(new RegisterOrganizerRequest(
            "deny@example.com",
            "password1",
            "Denier",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));
        await ConsentEvents.CreateAsync(
            registered.Id,
            new CreateConsentEventsRequest(
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Withdraw),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Withdraw),
            ]));
        var denyPdId = Guid.Parse("12121212-1212-1212-1212-121212121212");
        var denyTermsId = Guid.Parse("34343434-3434-3434-3434-343434343434");
        var request = new CreateConsentEventsRequest(
        [
            new ConsentInputDto(denyPdId, PdVersionId, PdHash, ConsentDecision.Deny),
            new ConsentInputDto(denyTermsId, TermsVersionId, TermsHash, ConsentDecision.Deny),
        ]);

        // Act
        var created = await ConsentEvents.CreateAsync(registered.Id, request);

        // Assert
        var events = await ConsentEvents.ListAsync(registered.Id);
        Assert.That(created.All(e => e.Decision == ConsentDecision.Deny), Is.True);
        Assert.That(events.Any(e => e.Id == denyPdId && e.Decision == ConsentDecision.Deny), Is.True);
        Assert.That(events.Count, Is.GreaterThanOrEqualTo(6));
    }
}
