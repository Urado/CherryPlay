using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Tests;

public class LegalConsentDocumentsServiceTests
{
    private ILegalDocumentsService LegalDocuments = null!;

    private static readonly Guid PdVersionId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TermsVersionId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private const string PdHash = "pd-consent-hash-v1";
    private const string TermsHash = "terms-hash-v1";

    [SetUp]
    public void SetUp()
    {
        LegalDocuments = new LegalConsentInMemoryFixture().LegalDocuments;
    }

    [Test]
    public async Task HP01_GetRequiredActive_SeededPdAndTerms_EnsureActiveReady_AndHasGrantFalse()
    {
        // Arrange
        var subjectId = Guid.Parse("01010101-0101-0101-0101-010101010101");

        // Act
        var required = await LegalDocuments.GetRequiredActiveAsync();

        // Assert
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
        // Arrange

        // Act
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () =>
            await LegalDocuments.EnsureActiveConsentAsync(PdVersionId, "wrong-hash"));

        // Assert
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
    }

    [Test]
    public void EnsureActiveConsentAsync_UnknownVersionId_ThrowsValidation()
    {
        // Arrange
        var unknownId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");

        // Act
        var ex = Assert.ThrowsAsync<LegalConsentException>(async () =>
            await LegalDocuments.EnsureActiveConsentAsync(unknownId, PdHash));

        // Assert
        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
    }

    [Test]
    public async Task HasGrantAsync_UnknownSubject_ReturnsFalse()
    {
        // Arrange
        var unknownSubjectId = Guid.Parse("02020202-0202-0202-0202-020202020202");

        // Act
        var hasGrant = await LegalDocuments.HasGrantAsync(unknownSubjectId, PdVersionId);

        // Assert
        Assert.That(hasGrant, Is.False);
    }
}
