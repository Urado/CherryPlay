using System.Net;
using System.Text.Json;
using CherryPlayServer.Infrastructure;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class GitHubDesktopReleaseSourceTests
{
    [Test]
    public async Task GetLatestVersion_SelectsHighestNumericVersionWithTrustedZipAcrossAllPages()
    {
        var requests = new List<string>();
        using var handler = new DesktopReleaseHttpHandlerStub((request, _) =>
        {
            requests.Add(request.RequestUri!.AbsoluteUri);
            object[] releases = requests.Count == 1
                ? Enumerable.Repeat(Release("0.9.0"), 100).ToArray()
                : [Release("0.10.0", prefix: "CherryPashkaList"), Release("0.20.0", prerelease: false),
                    Release("0.30.0", draft: true), Release("0.40.0", name: "setup.exe"),
                    Release("0.50.0", tag: "web-v0.50.0")];
            return Task.FromResult(Response(JsonSerializer.Serialize(releases)));
        });
        var source = new GitHubDesktopReleaseSource(new DesktopReleaseHttpClientFactoryStub(handler));

        Assert.That(await source.GetLatestVersionAsync(CancellationToken.None), Is.EqualTo("0.10.0"));
        Assert.That(requests, Is.EqualTo(new[]
        {
            "https://api.github.com/repos/Urado/CherryPlay/releases?per_page=100&page=1",
            "https://api.github.com/repos/Urado/CherryPlay/releases?per_page=100&page=2"
        }));
    }

    [TestCase("https://evil.example/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPashkaParty-0.7.0-x64.zip")]
    [TestCase("http://github.com/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPashkaParty-0.7.0-x64.zip")]
    [TestCase("https://user@github.com/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPashkaParty-0.7.0-x64.zip")]
    [TestCase("https://github.com:8443/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPashkaParty-0.7.0-x64.zip")]
    [TestCase("https://github.com/Other/CherryPlay/releases/download/player-v0.7.0/CherryPashkaParty-0.7.0-x64.zip")]
    [TestCase("https://github.com/Urado/CherryPlay/releases/download/player-v0.8.0/CherryPashkaParty-0.7.0-x64.zip")]
    [TestCase("https://github.com/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPashkaParty-0.7.0-x64.zip?x=1")]
    [TestCase("https://github.com/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPashkaParty-0.7.0-x64.zip#x")]
    public async Task GetLatestVersion_RejectsUntrustedAssetUrl(string url)
    {
        Assert.That(await FetchAsync([Release("0.7.0", url: url)]), Is.Null);
    }

    [TestCase("CherryPashkaList")]
    [TestCase("CherryPashkaParty")]
    public async Task GetLatestVersion_AcceptsExactSupportedZipNames(string prefix)
        => Assert.That(await FetchAsync([Release("0.7.0", prefix: prefix)]), Is.EqualTo("0.7.0"));

    [Test]
    public async Task GetLatestVersion_HandlesArbitraryLengthNumericComponents()
        => Assert.That(await FetchAsync([Release("999999999999999999999.0.0"), Release("1000000000000000000000.0.0")]),
            Is.EqualTo("1000000000000000000000.0.0"));

    [TestCase("player-v00.7.0")]
    [TestCase("player-v0.7.0-beta")]
    [TestCase("player-v0.7.0\n")]
    public async Task GetLatestVersion_RejectsInvalidTags(string tag)
        => Assert.That(await FetchAsync([Release("0.7.0", tag: tag)]), Is.Null);

    [TestCase("[{}]")]
    [TestCase("[{\"prerelease\":true,\"tag_name\":\"player-v0.7.0\",\"assets\":[{}]}]")]
    public async Task GetLatestVersion_SkipsInvalidReleases_ReturnsNullWhenNoneValid(string payload)
    {
        using var handler = new DesktopReleaseHttpHandlerStub((_, _) => Task.FromResult(Response(payload)));
        var source = new GitHubDesktopReleaseSource(new DesktopReleaseHttpClientFactoryStub(handler));
        Assert.That(await source.GetLatestVersionAsync(CancellationToken.None), Is.Null);
    }

    [Test]
    public async Task GetLatestVersion_SkipsInvalidReleaseAndKeepsValidMax()
    {
        var payload = JsonSerializer.Serialize(new object[]
        {
            new { },
            Release("0.6.0"),
            new { prerelease = true, tag_name = "player-v0.9.0", assets = new[] { new { } } },
            Release("0.8.0"),
            Release("0.7.0")
        });
        using var handler = new DesktopReleaseHttpHandlerStub((_, _) => Task.FromResult(Response(payload)));
        var source = new GitHubDesktopReleaseSource(new DesktopReleaseHttpClientFactoryStub(handler));
        Assert.That(await source.GetLatestVersionAsync(CancellationToken.None), Is.EqualTo("0.8.0"));
    }

    [Test]
    public void GetLatestVersion_NonArrayPayload_Throws()
    {
        using var handler = new DesktopReleaseHttpHandlerStub((_, _) => Task.FromResult(Response("{}")));
        var source = new GitHubDesktopReleaseSource(new DesktopReleaseHttpClientFactoryStub(handler));
        Assert.ThrowsAsync<InvalidDataException>(() => source.GetLatestVersionAsync(CancellationToken.None));
    }

    [Test]
    public void GetLatestVersion_GitHubFailure_Throws()
    {
        using var handler = new DesktopReleaseHttpHandlerStub((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)));
        var source = new GitHubDesktopReleaseSource(new DesktopReleaseHttpClientFactoryStub(handler));
        Assert.ThrowsAsync<HttpRequestException>(() => source.GetLatestVersionAsync(CancellationToken.None));
    }

    [Test]
    public async Task GetLatestVersion_NoReleases_ReturnsNull()
        => Assert.That(await FetchAsync([]), Is.Null);

    [Test]
    public void GetLatestVersion_LaterPageFailure_DoesNotReturnIncompleteResult()
    {
        var calls = 0;
        using var handler = new DesktopReleaseHttpHandlerStub((_, _) => Task.FromResult(++calls == 1
            ? Response(JsonSerializer.Serialize(Enumerable.Repeat(Release("0.7.0"), 100)))
            : new HttpResponseMessage(HttpStatusCode.Forbidden)));
        var source = new GitHubDesktopReleaseSource(new DesktopReleaseHttpClientFactoryStub(handler));

        Assert.ThrowsAsync<HttpRequestException>(() => source.GetLatestVersionAsync(CancellationToken.None));
        Assert.That(calls, Is.EqualTo(2));
    }

    private static object Release(string version, bool prerelease = true, bool draft = false,
        string prefix = "CherryPashkaParty", string? name = null, string? url = null, string? tag = null)
    {
        name ??= $"{prefix}-{version}-x64.zip";
        return new
        {
            prerelease, draft, tag_name = tag ?? $"player-v{version}",
            assets = new[] { new { name, browser_download_url = url ?? $"https://github.com/Urado/CherryPlay/releases/download/player-v{version}/{name}" } }
        };
    }

    private static async Task<string?> FetchAsync(object[] releases)
    {
        using var handler = new DesktopReleaseHttpHandlerStub((_, _) => Task.FromResult(Response(JsonSerializer.Serialize(releases))));
        return await new GitHubDesktopReleaseSource(new DesktopReleaseHttpClientFactoryStub(handler))
            .GetLatestVersionAsync(CancellationToken.None);
    }

    private static HttpResponseMessage Response(string payload) => new(HttpStatusCode.OK) { Content = new StringContent(payload) };
}
