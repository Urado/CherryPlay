using System.Text.Json;
using CherryPlay.LegalPublish;

namespace CherryPlayServer.Tests;

public class LegalContentHasherTests
{
    // Trim drops trailing newline vs pre-trim hash of the same LF string.
    private const string KnownFixtureHash =
        "28bc6770e58b2d90ce9405edb39e6e1ee5f368b81c174b3e6dc2767a553ca335";

    [Test]
    public void HashText_KnownFixture_MatchesExpectedSha256()
    {
        const string bodyCrlf =
            "Line one.\r\n\r\nLine two with unicode: привет.\r\n";

        var lf = LegalContentHasher.NormalizeNewlinesToLf(bodyCrlf);
        Assert.That(lf, Does.Not.Contain("\r"));
        Assert.That(LegalContentHasher.HashText(bodyCrlf), Is.EqualTo(KnownFixtureHash));
        Assert.That(LegalContentHasher.HashText(lf), Is.EqualTo(KnownFixtureHash));
    }

    [Test]
    public void HashText_ConsentAndTermsFixtures_MatchGeneratedRegistry()
    {
        var repoRoot = RequireRepoRoot();
        var contentRoot = Path.Combine(repoRoot, "CherryPlayWeb", "src", "content", "legal");
        var registryPath = Path.Combine(
            repoRoot,
            "CherryPlayComponents",
            "src",
            "constants",
            "legal-registry.generated.json");

        Assert.That(File.Exists(registryPath), Is.True, "Run CherryPlay.LegalPublish to generate registry JSON.");

        var recomputed = LegalRegistryBuilder.Build(contentRoot, "1.0", DateTimeOffset.UnixEpoch);
        var registry = JsonSerializer.Deserialize<LegalRegistry>(File.ReadAllText(registryPath))
            ?? throw new InvalidOperationException("Failed to deserialize legal-registry.generated.json");

        foreach (var type in new[] { "pd_consent_text", "terms" })
        {
            var fromMarkdown = RequireDoc(recomputed, type);
            var fromRegistry = RequireDoc(registry, type);
            Assert.That(
                fromRegistry.ContentHash,
                Is.EqualTo(fromMarkdown.ContentHash),
                $"{type}: registry hash != recomputed markdown hash (re-run LegalPublish)");
            Assert.That(fromRegistry.DocumentVersion, Is.EqualTo(fromMarkdown.DocumentVersion));
            Assert.That(fromRegistry.EffectiveFrom, Is.EqualTo(fromMarkdown.EffectiveFrom));
            Assert.That(fromRegistry.VersionId, Is.EqualTo(fromMarkdown.VersionId));
        }
    }

    private static LegalRegistryDocument RequireDoc(LegalRegistry registry, string type) =>
        registry.Documents.FirstOrDefault(d => d.Type == type)
        ?? throw new AssertionException($"Registry missing {type}");

    private static string RequireRepoRoot()
    {
        var root = FindRepoRoot();
        Assert.That(root, Is.Not.Null, "Could not find CherryPlay.sln from test directory");
        return root!;
    }

    private static string? FindRepoRoot()
    {
        var dir = new DirectoryInfo(TestContext.CurrentContext.TestDirectory);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "CherryPlay.sln")))
            {
                return dir.FullName;
            }

            dir = dir.Parent;
        }

        return null;
    }
}
