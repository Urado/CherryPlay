using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;

namespace CherryPlayServer.Tests;

public class LegalConsentIdempotencyTests
{
    private IOrganizersService Organizers = null!;
    private IOAuthAccountsService OAuthAccounts = null!;
    private IConsentEventsService ConsentEvents = null!;

    private static readonly Guid PdVersionId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TermsVersionId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private const string PdHash = "2cdeb1176caf020a42e92e302f016d8dbe4a81dc89838218b92ce655bb6d14a3";
    private const string TermsHash = "6dffebc1d8cbd1b32d0f21ae2b438a58917e52c06612255049e6f00174c6d399";

    [SetUp]
    public void SetUp()
    {
        var fixture = new LegalConsentInMemoryFixture();
        Organizers = fixture.Organizers;
        OAuthAccounts = fixture.OAuthAccounts;
        ConsentEvents = fixture.ConsentEvents;
    }

    [Test]
    public async Task ID01_CreateAsync_ReplaySameEventIdAndBody_SucceedsWithoutDuplicate()
    {
        var grantPdId = Guid.Parse("10101010-1010-1010-1010-101010101010");
        var grantTermsId = Guid.Parse("20202020-2020-2020-2020-202020202020");
        var registered = await Organizers.RegisterAsync(new RegisterOrganizerRequest(
            "id01@example.com",
            "password1",
            "ID01 Organizer",
            [
                new ConsentInputDto(grantPdId, PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(grantTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));
        var replay = new CreateConsentEventsRequest(
        [
            new ConsentInputDto(grantPdId, PdVersionId, PdHash, ConsentDecision.Grant),
            new ConsentInputDto(grantTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
        ]);
        var first = await ConsentEvents.CreateAsync(registered.Id, replay);
        var second = await ConsentEvents.CreateAsync(registered.Id, replay);
        var listed = await ConsentEvents.ListAsync(registered.Id);
        Assert.That(first.Select(e => e.Id), Is.EquivalentTo(new[] { grantPdId, grantTermsId }));
        Assert.That(second.Select(e => e.Id), Is.EquivalentTo(new[] { grantPdId, grantTermsId }));
        Assert.That(listed.Count(e => e.Id == grantPdId), Is.EqualTo(1));
        Assert.That(listed.Count(e => e.Id == grantTermsId), Is.EqualTo(1));
    }

    [Test]
    public async Task ID02_CreateAsync_SameIdDifferentPayload_ThrowsConflict_AndOriginalUnchanged()
    {
        var grantPdId = Guid.Parse("30303030-3030-3030-3030-303030303030");
        var grantTermsId = Guid.Parse("40404040-4040-4040-4040-404040404040");
        var registered = await Organizers.RegisterAsync(new RegisterOrganizerRequest(
            "id02@example.com",
            "password1",
            "ID02 Organizer",
            [
                new ConsentInputDto(grantPdId, PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(grantTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));
        var before = await ConsentEvents.ListAsync(registered.Id);
        var originalPd = before.Single(e => e.Id == grantPdId);
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () =>
            await ConsentEvents.CreateAsync(
                registered.Id,
                new CreateConsentEventsRequest(
                [
                    new ConsentInputDto(grantPdId, PdVersionId, PdHash, ConsentDecision.Withdraw),
                    new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
                ])));
        var after = await ConsentEvents.ListAsync(registered.Id);
        var stillPd = after.Single(e => e.Id == grantPdId);
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Conflict));
        Assert.That(stillPd.Decision, Is.EqualTo(originalPd.Decision));
        Assert.That(stillPd.DocumentHash, Is.EqualTo(originalPd.DocumentHash));
        Assert.That(after.Count, Is.EqualTo(before.Count));
    }

    [Test]
    public async Task ID03_RegisterAsync_ReplaySameConsentIds_IsIdempotent()
    {
        var grantPdId = Guid.Parse("50505050-5050-5050-5050-505050505050");
        var grantTermsId = Guid.Parse("60606060-6060-6060-6060-606060606060");
        var request = new RegisterOrganizerRequest(
            "id03@example.com",
            "password1",
            "ID03 Organizer",
            [
                new ConsentInputDto(grantPdId, PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(grantTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]);
        var first = await Organizers.RegisterAsync(request);
        var second = await Organizers.RegisterAsync(request);
        var events = await ConsentEvents.ListAsync(first.Id);
        Assert.That(second.Id, Is.EqualTo(first.Id));
        Assert.That(events.Count(e => e.Id == grantPdId), Is.EqualTo(1));
        Assert.That(events.Count(e => e.Id == grantTermsId), Is.EqualTo(1));
    }

    [Test]
    public async Task ID04_RegisterAsync_ParallelSameEmail_ExactlyOneSuccessOrOneConflict()
    {
        var email = "id04@example.com";
        var buildRequest = () => new RegisterOrganizerRequest(
            email,
            "password1",
            "ID04 Organizer",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]);
        var results = await Task.WhenAll(
            RunRegisterOutcomeAsync(buildRequest()),
            RunRegisterOutcomeAsync(buildRequest()));
        var successes = results.Count(r => r.Succeeded);
        var conflicts = results.Count(r => r.Kind == LegalConsentFailureKind.Conflict);
        Assert.That(successes, Is.EqualTo(1), "Exactly one parallel RegisterAsync must succeed");
        Assert.That(conflicts, Is.EqualTo(1), "The other parallel RegisterAsync must fail with Conflict");
    }

    [Test]
    public async Task ID05_OAuthCreateAsync_ExistingLoginIgnoresConsentPayload_DoesNotDuplicateEvents()
    {
        var grantPdId = Guid.Parse("70707070-7070-7070-7070-707070707070");
        var grantTermsId = Guid.Parse("80808080-8080-8080-8080-808080808080");
        var first = await OAuthAccounts.CreateAsync(new CreateOAuthAccountRequest(
            OAuthProvider.Vk,
            "replay-oauth-code",
            [
                new ConsentInputDto(grantPdId, PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(grantTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));
        var second = await OAuthAccounts.CreateAsync(new CreateOAuthAccountRequest(
            OAuthProvider.Vk,
            "replay-oauth-code",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));
        var events = await ConsentEvents.ListAsync(first.Id);
        Assert.That(second.Id, Is.EqualTo(first.Id));
        Assert.That(second.ProviderSubject, Is.EqualTo("vk:replay-oauth-code"));
        Assert.That(second.AccessToken, Is.EqualTo($"token:{first.Id:N}"));
        Assert.That(events, Has.Count.EqualTo(2));
        Assert.That(events.Select(e => e.Id), Is.EquivalentTo(new[] { grantPdId, grantTermsId }));
    }

    [Test]
    public async Task ID06_CreateAsync_ParallelSameEventId_IsIdempotent()
    {
        var grantPdId = Guid.Parse("90909090-9090-9090-9090-909090909090");
        var grantTermsId = Guid.Parse("a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0");
        var registered = await Organizers.RegisterAsync(new RegisterOrganizerRequest(
            "id06@example.com",
            "password1",
            "ID06 Organizer",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));
        var request = new CreateConsentEventsRequest(
        [
            new ConsentInputDto(grantPdId, PdVersionId, PdHash, ConsentDecision.Grant),
            new ConsentInputDto(grantTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
        ]);
        await Task.WhenAll(
            ConsentEvents.CreateAsync(registered.Id, request),
            ConsentEvents.CreateAsync(registered.Id, request));
        var listed = await ConsentEvents.ListAsync(registered.Id);
        Assert.That(listed.Count(e => e.Id == grantPdId), Is.EqualTo(1));
        Assert.That(listed.Count(e => e.Id == grantTermsId), Is.EqualTo(1));
    }

    [Test]
    public async Task ID07_CreateAsync_WithdrawThenGrantWithNewIds_ListContainsBothDecisions()
    {
        var registered = await Organizers.RegisterAsync(new RegisterOrganizerRequest(
            "id07@example.com",
            "password1",
            "ID07 Organizer",
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));
        var withdrawPdId = Guid.Parse("b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1");
        var withdrawTermsId = Guid.Parse("b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2");
        var grantPdId = Guid.Parse("c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1");
        var grantTermsId = Guid.Parse("c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2");
        await ConsentEvents.CreateAsync(
            registered.Id,
            new CreateConsentEventsRequest(
            [
                new ConsentInputDto(withdrawPdId, PdVersionId, PdHash, ConsentDecision.Withdraw),
                new ConsentInputDto(withdrawTermsId, TermsVersionId, TermsHash, ConsentDecision.Withdraw),
            ]));
        var grantRequest = new CreateConsentEventsRequest(
        [
            new ConsentInputDto(grantPdId, PdVersionId, PdHash, ConsentDecision.Grant),
            new ConsentInputDto(grantTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
        ]);
        await ConsentEvents.CreateAsync(registered.Id, grantRequest);
        var events = await ConsentEvents.ListAsync(registered.Id);
        Assert.That(events.Any(e => e.Id == withdrawPdId && e.Decision == ConsentDecision.Withdraw), Is.True);
        Assert.That(events.Any(e => e.Id == withdrawTermsId && e.Decision == ConsentDecision.Withdraw), Is.True);
        Assert.That(events.Any(e => e.Id == grantPdId && e.Decision == ConsentDecision.Grant), Is.True);
        Assert.That(events.Any(e => e.Id == grantTermsId && e.Decision == ConsentDecision.Grant), Is.True);
    }

    [Test]
    public async Task ID08_CreateAsync_BatchWithCollidingIdDifferentPayload_FailsWholeBatch_ExistingUntouched()
    {
        var existingPdId = Guid.Parse("d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1");
        var existingTermsId = Guid.Parse("d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2");
        var registered = await Organizers.RegisterAsync(new RegisterOrganizerRequest(
            "id08@example.com",
            "password1",
            "ID08 Organizer",
            [
                new ConsentInputDto(existingPdId, PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(existingTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));
        var before = await ConsentEvents.ListAsync(registered.Id);
        var newTermsId = Guid.Parse("d3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3");
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () =>
            await ConsentEvents.CreateAsync(
                registered.Id,
                new CreateConsentEventsRequest(
                [
                    new ConsentInputDto(existingPdId, PdVersionId, PdHash, ConsentDecision.Withdraw),
                    new ConsentInputDto(newTermsId, TermsVersionId, TermsHash, ConsentDecision.Grant),
                ])));
        var after = await ConsentEvents.ListAsync(registered.Id);
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Conflict));
        Assert.That(after.Select(e => e.Id), Is.EquivalentTo(before.Select(e => e.Id)));
        Assert.That(after.Any(e => e.Id == newTermsId), Is.False);
        Assert.That(after.Single(e => e.Id == existingPdId).Decision, Is.EqualTo(ConsentDecision.Grant));
    }

    private async Task<(bool Succeeded, LegalConsentFailureKind? Kind)> RunRegisterOutcomeAsync(
        RegisterOrganizerRequest request)
    {
        try
        {
            await Organizers.RegisterAsync(request);
            return (true, null);
        }
        catch (LegalConsentException ex)
        {
            return (false, ex.Kind);
        }
    }
}
