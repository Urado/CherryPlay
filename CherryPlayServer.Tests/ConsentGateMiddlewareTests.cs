using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CherryPlayServer.Tests;

[TestFixture]
public class ConsentGateMiddlewareTests
{
    private static readonly Guid PdVersionId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TermsVersionId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private const string PdHash = "2cdeb1176caf020a42e92e302f016d8dbe4a81dc89838218b92ce655bb6d14a3";
    private const string TermsHash = "6dffebc1d8cbd1b32d0f21ae2b438a58917e52c06612255049e6f00174c6d399";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private ConsentGateTestWebApplicationFactory _factory = null!;
    private HttpClient _client = null!;

    [SetUp]
    public void SetUp()
    {
        _factory = new ConsentGateTestWebApplicationFactory();
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
    public async Task Write_WithoutRequiredGrants_Returns403ConsentRequiredWithMissing()
    {
        await LoginAsLegacyAsync();

        using var response = await _client.PatchAsync(
            "/api/organizer/profile",
            JsonContent(new { name = "Blocked Legacy" }));
        var body = await response.Content.ReadAsStringAsync();

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Forbidden), body);
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        Assert.That(root.GetProperty("code").GetString(), Is.EqualTo("consent_required"));
        Assert.That(root.GetProperty("message").GetString(), Is.EqualTo("Consent required"));
        var missing = root.GetProperty("missing").EnumerateArray().Select(e => e.GetString()).ToArray();
        Assert.That(
            missing,
            Is.EquivalentTo(new[] { PdVersionId.ToString(), TermsVersionId.ToString() }));
    }

    [Test]
    public async Task PostConsentEvents_WithoutPriorGrants_Returns201()
    {
        await LoginAsLegacyAsync();

        using var response = await _client.PostAsync(
            "/api/consent-events",
            JsonContent(new
            {
                events = new object[]
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
        var body = await response.Content.ReadAsStringAsync();

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.Created), body);
    }

    [Test]
    public async Task Write_AfterRequiredGrants_Succeeds()
    {
        await LoginAsLegacyAsync();

        using var grantResponse = await _client.PostAsync(
            "/api/consent-events",
            JsonContent(new
            {
                events = new object[]
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
        Assert.That(grantResponse.StatusCode, Is.EqualTo(HttpStatusCode.Created), await grantResponse.Content.ReadAsStringAsync());

        using var response = await _client.PatchAsync(
            "/api/organizer/profile",
            JsonContent(new { name = "Consented Legacy" }));
        var body = await response.Content.ReadAsStringAsync();

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK), body);
        using var doc = JsonDocument.Parse(body);
        Assert.That(doc.RootElement.GetProperty("name").GetString(), Is.EqualTo("Consented Legacy"));
    }

    private async Task LoginAsLegacyAsync()
    {
        using var loginResponse = await _client.PostAsync(
            "/auth/login",
            JsonContent(new { email = "legacy@t.ru", password = "123456" }));
        var loginBody = await loginResponse.Content.ReadAsStringAsync();
        Assert.That(loginResponse.StatusCode, Is.EqualTo(HttpStatusCode.OK), loginBody);

        using var doc = JsonDocument.Parse(loginBody);
        var token = doc.RootElement.GetProperty("accessToken").GetString();
        Assert.That(token, Is.Not.Null.And.Not.Empty);
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private static StringContent JsonContent(object payload) =>
        new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

    private sealed class ConsentGateTestWebApplicationFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("UseInMemoryStorage", "true");
            builder.UseSetting("JWT_SECRET_KEY", "consent-gate-tests-secret-key-minimum-32-chars");
            builder.UseSetting("Auth:OAuthEnabled", "false");
        }
    }
}
