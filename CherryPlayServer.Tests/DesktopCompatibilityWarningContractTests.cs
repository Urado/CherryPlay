using System.Net;
using System.Text.Json;
using CherryPlayServer.Core.Middleware;

namespace CherryPlayServer.Tests;

[TestFixture]
public class DesktopCompatibilityWarningContractTests
{
    [Test]
    public async Task GetConfig_OutdatedUnauthenticatedDesktop_ReturnsFutureWarning()
    {
        await using var factory = new DesktopCompatibilityWarningTestFactory();
        using var client = factory.CreateClient();
        using var request = CreateDesktopRequest("/api/config", "0.1.0");

        using var response = await client.SendAsync(request);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(json.RootElement.GetProperty("oauthEnabled").GetBoolean(), Is.False);
        Assert.That(json.RootElement.TryGetProperty("partyInfoPageEnabled", out _), Is.True);
        Assert.That(json.RootElement.TryGetProperty("adminContactUrl", out _), Is.True);
        var warning = json.RootElement.GetProperty("desktopCompatibilityWarning");
        Assert.That(warning.EnumerateObject().Select(property => property.Name),
            Is.EquivalentTo(new[] { "minVersion", "serverVersion" }));
        Assert.That(warning.GetProperty("minVersion").GetString(), Is.EqualTo("0.7.0"));
        Assert.That(warning.GetProperty("serverVersion").GetString(), Is.EqualTo("0.8.0"));
    }

    [TestCase("", "")]
    [TestCase("0.7.0", "")]
    [TestCase("invalid", "0.8.0")]
    [TestCase("0.7.0", "0.6.4")]
    public async Task GetConfig_DisabledOrInvalidAnnouncement_ReturnsExplicitNull(
        string nextMinimum, string nextServer)
    {
        await using var factory = new DesktopCompatibilityWarningTestFactory(nextMinimum, nextServer);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/config");
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(json.RootElement.GetProperty("desktopCompatibilityWarning").ValueKind,
            Is.EqualTo(JsonValueKind.Null));
    }

    [TestCase("0.6.4", HttpStatusCode.OK)]
    [TestCase("0.6.0", HttpStatusCode.OK)]
    [TestCase("0.5.9", (HttpStatusCode)426)]
    public async Task GetPublicParties_FutureWarning_DoesNotChangeCurrentVersionGate(
        string version, HttpStatusCode expectedStatus)
    {
        await using var factory = new DesktopCompatibilityWarningTestFactory();
        using var client = factory.CreateClient();
        using var request = CreateDesktopRequest("/api/parties/public/list", version);

        using var response = await client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(expectedStatus));
        if (expectedStatus == (HttpStatusCode)426)
        {
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.That(json.RootElement.GetProperty("requiredVersion").GetString(), Is.EqualTo("0.6.4"));
        }
    }

    [Test]
    public async Task GetOpenApi_ConfigResponse_ContainsWarningSchema()
    {
        await using var factory = new DesktopCompatibilityWarningTestFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/swagger/v1/swagger.json");
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        var responseSchema = json.RootElement.GetProperty("paths").GetProperty("/api/config")
            .GetProperty("get").GetProperty("responses").GetProperty("200")
            .GetProperty("content").GetProperty("application/json").GetProperty("schema");
        Assert.That(responseSchema.GetProperty("$ref").GetString(), Is.EqualTo("#/components/schemas/AppConfigResponse"));
        var schemas = json.RootElement.GetProperty("components").GetProperty("schemas");
        Assert.That(schemas.GetProperty("AppConfigResponse").GetProperty("properties")
            .TryGetProperty("desktopCompatibilityWarning", out _), Is.True);
        Assert.That(schemas.GetProperty("DesktopCompatibilityWarning").GetProperty("properties")
            .EnumerateObject().Select(property => property.Name),
            Is.EquivalentTo(new[] { "minVersion", "serverVersion" }));
    }

    private static HttpRequestMessage CreateDesktopRequest(string path, string version)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Add(ClientVersionMiddleware.ClientVersionHeaderName, version);
        request.Headers.Add(ClientVersionMiddleware.ClientAppHeaderName, ClientVersionMiddleware.ClientAppDesktop);
        return request;
    }
}
