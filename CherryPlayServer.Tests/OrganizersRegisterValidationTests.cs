using CherryPlayServer.Core;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;

namespace CherryPlayServer.Tests;

[TestFixture]
public class OrganizersRegisterValidationTests
{
    private IOrganizersService _organizers = null!;

    private static readonly Guid PdVersionId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TermsVersionId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private const string PdHash = "1ec5bcae20671f7083e7a3a58525d7d628c7aa1b6b20c0462aea46a09ccd5f6f";
    private const string TermsHash = "c9290febb6dce3229775dba33b7a766a09f769963f82331ccd34dc274f32334d";

    [SetUp]
    public void SetUp()
    {
        _organizers = new LegalConsentInMemoryFixture().Organizers;
    }

    [Test]
    public async Task RegisterAsync_MixedCaseEmail_PersistsLowerInvariant()
    {
        var request = ValidRequest("  Mixed.Case@Example.COM  ", "password1", "Normalize Me");

        var response = await _organizers.RegisterAsync(request);

        Assert.That(response.Email, Is.EqualTo("mixed.case@example.com"));
    }

    [Test]
    public void RegisterAsync_InvalidEmail_ThrowsValidation()
    {
        var request = ValidRequest("not-an-email", "password1", "Bad Email");

        var ex = Assert.ThrowsAsync<LegalConsentException>(async () => await _organizers.RegisterAsync(request));

        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
        Assert.That(ex.Message, Is.EqualTo("Invalid email format"));
    }

    [Test]
    public void RegisterAsync_ShortPassword_ThrowsValidation()
    {
        var request = ValidRequest("shortpwd@example.com", "12345", "Short Pwd");

        var ex = Assert.ThrowsAsync<LegalConsentException>(async () => await _organizers.RegisterAsync(request));

        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
        Assert.That(
            ex.Message,
            Is.EqualTo($"Password must be at least {AuthConstants.MinPasswordLength} characters long"));
    }

    [Test]
    public void RegisterAsync_NameTooLong_ThrowsValidation()
    {
        var longName = new string('a', AuthConstants.MaxOrganizerNameLength + 1);
        var request = ValidRequest("longname@example.com", "password1", longName);

        var ex = Assert.ThrowsAsync<LegalConsentException>(async () => await _organizers.RegisterAsync(request));

        Assert.That(ex!.Kind, Is.EqualTo(LegalConsentFailureKind.Validation));
        Assert.That(
            ex.Message,
            Is.EqualTo("Name is required and must not exceed " + AuthConstants.MaxOrganizerNameLength + " characters"));
    }

    private static RegisterOrganizerRequest ValidRequest(string email, string password, string name) =>
        new(
            email,
            password,
            name,
            [
                new ConsentInputDto(
                    Guid.Parse("11111111-1111-1111-1111-111111111111"),
                    PdVersionId,
                    PdHash,
                    ConsentDecision.Grant),
                new ConsentInputDto(
                    Guid.Parse("22222222-2222-2222-2222-222222222222"),
                    TermsVersionId,
                    TermsHash,
                    ConsentDecision.Grant),
            ]);
}
