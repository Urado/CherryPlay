using System.Net;
using System.Text.Json;
using CherryPlayServer.Infrastructure;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class GitHubDesktopReleaseSourceInvalidSiblingTests
{
    [Test]
    public async Task GetLatestVersion_InvalidSiblingAsset_ContinuesAndReturnsTrustedZip()
    {
        var payload = JsonSerializer.Serialize(new object[]
        {
            new
            {
                prerelease = true,
                draft = false,
                tag_name = "player-v0.7.0",
                assets = new object[]
                {
                    new { },
                    new
                    {
                        name = "notes.txt",
                        browser_download_url = "https://example.com/notes.txt"
                    },
                    new
                    {
                        name = "CherryPashkaParty-0.7.0-x64.zip",
                        browser_download_url =
                            "https://github.com/Urado/CherryPlay/releases/download/player-v0.7.0/CherryPashkaParty-0.7.0-x64.zip"
                    }
                }
            }
        });
        using var handler = new DesktopReleaseHttpHandlerStub((_, _) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(payload) }));
        var source = new GitHubDesktopReleaseSource(new DesktopReleaseHttpClientFactoryStub(handler));

        Assert.That(await source.GetLatestVersionAsync(CancellationToken.None), Is.EqualTo("0.7.0"));
    }
}
