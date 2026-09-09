using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CherryPlayServer.Tests;

[TestFixture]
public class AccountDeletionHttpTests
{
    private static readonly Guid PdVersionId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TermsVersionId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private const string PdHash = "4fb5ee6b4636828a5f72c3b1091721e02c53c93160db5449e80348f24e0f84bc";
    private const string TermsHash = "63446e6df641cb350ba24e197390c03f76ded704bfe12e692eeeb62c84e14b44";

    private AccountDeletionHttpWebApplicationFactory _factory = null!;
    private HttpClient _client = null!;

    [SetUp]
    public void SetUp()
    {
        _factory = new AccountDeletionHttpWebApplicationFactory();
        _client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true
        });
    }

    [TearDown]
    public void TearDown()
    {
        _client.Dispose();
        _factory.Dispose();
    }

    [Test]
    public async Task DeleteAccount_WithoutAuth_Returns401()
    {
        using var response = await _client.DeleteAsync("/api/organizer/account");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Unauthorized));
    }

    [Test]
    public async Task DeleteAccount_Authenticated_Returns204()
    {
        var email = $"delete-{Guid.NewGuid():N}@example.com";
        const string password = "password1";

        using var registerResponse = await _client.PostAsync(
            "/api/organizers",
            JsonContent(new
            {
                email,
                password,
                name = "Delete Me Http",
                consents = new object[]
                {
                    new
                    {
                        id = Guid.NewGuid(),
                        legalDocumentVersionId = PdVersionId,
                        documentHash = PdHash,
                        decision = "grant"
                    },
                    new
                    {
                        id = Guid.NewGuid(),
                        legalDocumentVersionId = TermsVersionId,
                        documentHash = TermsHash,
                        decision = "grant"
                    }
                }
            }));
        var registerBody = await registerResponse.Content.ReadAsStringAsync();
        Assert.That(registerResponse.StatusCode, Is.EqualTo(HttpStatusCode.Created), registerBody);

        using var loginResponse = await _client.PostAsync(
            "/auth/login",
            JsonContent(new { email, password }));
        var loginBody = await loginResponse.Content.ReadAsStringAsync();
        Assert.That(loginResponse.StatusCode, Is.EqualTo(HttpStatusCode.OK), loginBody);

        using var loginDoc = JsonDocument.Parse(loginBody);
        var token = loginDoc.RootElement.GetProperty("accessToken").GetString();
        Assert.That(token, Is.Not.Null.And.Not.Empty);
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var deleteResponse = await _client.DeleteAsync("/api/organizer/account");
        var deleteBody = await deleteResponse.Content.ReadAsStringAsync();
        Assert.That(deleteResponse.StatusCode, Is.EqualTo(HttpStatusCode.NoContent), deleteBody);

        // Sessions are revoked on delete — stale bearer must not reach profile.
        using var meResponse = await _client.GetAsync("/api/organizer/me");
        Assert.That(
            meResponse.StatusCode,
            Is.EqualTo(HttpStatusCode.Unauthorized),
            await meResponse.Content.ReadAsStringAsync());

        _client.DefaultRequestHeaders.Authorization = null;
        using var reloginResponse = await _client.PostAsync(
            "/auth/login",
            JsonContent(new { email, password }));
        var reloginBody = await reloginResponse.Content.ReadAsStringAsync();
        Assert.That(
            reloginResponse.StatusCode,
            Is.EqualTo(HttpStatusCode.Unauthorized),
            reloginBody);
    }

    private static StringContent JsonContent(object payload) =>
        new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

    private sealed class AccountDeletionHttpWebApplicationFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("UseInMemoryStorage", "true");
            builder.UseSetting("JWT_SECRET_KEY", "account-deletion-http-tests-secret-key-32chars");
            builder.UseSetting("Auth:OAuthEnabled", "false");
        }
    }
}
