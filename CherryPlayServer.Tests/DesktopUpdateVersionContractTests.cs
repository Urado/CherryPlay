using System.Net;
using System.Text.Json;

namespace CherryPlayServer.Tests;

[TestFixture]
public class DesktopUpdateVersionContractTests
{
    [Test]
    public async Task GetConfig_ReturnsLatestDesktopReleaseVersion()
    {
        await using var factory = new DesktopCompatibilityWarningTestFactory(latestVersion: "0.8.0");
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/config");
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(json.RootElement.GetProperty("desktopUpdateVersion").GetString(),
            Is.EqualTo("0.8.0"));
    }

    [Test]
    public async Task GetConfig_UnavailableDesktopRelease_ReturnsNullAndKeepsCompatibilityWarning()
    {
        await using var factory = new DesktopCompatibilityWarningTestFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/config");
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(json.RootElement.GetProperty("desktopUpdateVersion").ValueKind,
            Is.EqualTo(JsonValueKind.Null));
        Assert.That(json.RootElement.GetProperty("desktopCompatibilityWarning").GetProperty("minVersion").GetString(),
            Is.EqualTo("0.7.0"));
        Assert.That(json.RootElement.GetProperty("oauthEnabled").GetBoolean(), Is.False);
    }
}
