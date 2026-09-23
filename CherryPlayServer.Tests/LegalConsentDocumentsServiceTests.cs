using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;

namespace CherryPlayServer.Tests;

public class LegalConsentDocumentsServiceTests
{
    private ILegalDocumentsService LegalDocuments = null!;

    private static readonly Guid PdVersionId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TermsVersionId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private const string PdHash = "2cdeb1176caf020a42e92e302f016d8dbe4a81dc89838218b92ce655bb6d14a3";
    private const string TermsHash = "6dffebc1d8cbd1b32d0f21ae2b438a58917e52c06612255049e6f00174c6d399";

    [SetUp]
    public void SetUp()
    {
        LegalDocuments = new LegalConsentInMemoryFixture().LegalDocuments;
    }

    [Test]
    public async Task HP01_GetRequiredActive_SeededPdAndTerms_EnsureActiveReady_AndHasGrantFalse()
    {
        var subjectId = Guid.Parse("01010101-0101-0101-0101-010101010101");
        var required = await LegalDocuments.GetRequiredActiveAsync();
        Assert.That(required, Has.Count.EqualTo(2));
        Assert.That(
            required.Select(d => (d.Id, d.DocumentType, d.ContentHash, d.Status)),
            Is.EquivalentTo(new[]
            {
                (PdVersionId, LegalDocumentType.PdConsentText, PdHash, LegalDocumentVersionStatus.Active),
                (TermsVersionId, LegalDocumentType.Terms, TermsHash, LegalDocumentVersionStatus.Active),
            }));
        Assert.DoesNotThrowAsync(async () =>
            await LegalDocuments.EnsureActiveConsentAsync(PdVersionId, PdHash));
        Assert.DoesNotThrowAsync(async () =>
            await LegalDocuments.EnsureActiveConsentAsync(TermsVersionId, TermsHash));
        Assert.That(await LegalDocuments.HasGrantAsync(subjectId, PdVersionId), Is.False);
        Assert.That(await LegalDocuments.HasGrantAsync(subjectId, TermsVersionId), Is.False);
    }

    [Test]
    public void EnsureActiveConsentAsync_WrongHash_ThrowsValidation()
    {
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () =>
            await LegalDocuments.EnsureActiveConsentAsync(PdVersionId, "wrong-hash"));
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
    }

    [Test]
    public void EnsureActiveConsentAsync_UnknownVersionId_ThrowsValidation()
    {
        var unknownId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () =>
            await LegalDocuments.EnsureActiveConsentAsync(unknownId, PdHash));
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
    }

    [Test]
    public async Task HasGrantAsync_UnknownSubject_ReturnsFalse()
    {
        var unknownSubjectId = Guid.Parse("02020202-0202-0202-0202-020202020202");
        var hasGrant = await LegalDocuments.HasGrantAsync(unknownSubjectId, PdVersionId);
        Assert.That(hasGrant, Is.False);
    }

    [Test]
    public async Task GetMissingRequiredGrantsAsync_NoGrants_ReturnsBothActiveIds()
    {
        var subjectId = Guid.Parse("03030303-0303-0303-0303-030303030303");

        var missing = await LegalDocuments.GetMissingRequiredGrantsAsync(subjectId);

        Assert.That(missing, Is.EquivalentTo(new[] { PdVersionId, TermsVersionId }));
    }

    [Test]
    public async Task GetMissingRequiredGrantsAsync_AfterRequiredGrants_ReturnsEmpty()
    {
        var fixture = new LegalConsentInMemoryFixture();
        var subjectId = Guid.Parse("04040404-0404-0404-0404-040404040404");
        await fixture.ConsentEvents.CreateAsync(
            subjectId,
            new CreateConsentEventsRequest(
            [
                new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
                new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant),
            ]));

        var missing = await fixture.LegalDocuments.GetMissingRequiredGrantsAsync(subjectId);

        Assert.That(missing, Is.Empty);
    }
}
