using System.Text.Json;
using System.Text.RegularExpressions;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure;

public sealed class GitHubDesktopReleaseSource(IHttpClientFactory httpClientFactory) : IDesktopReleaseSource
{
    public const string HttpClientName = "GitHubDesktopReleases";
    private const int MaxPages = 10;
    private static readonly Regex TagPattern = new(@"\Aplayer-v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\z",
        RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1));

    public async Task<string?> GetLatestVersionAsync(CancellationToken cancellationToken)
    {
        using var client = httpClientFactory.CreateClient(HttpClientName);
        string? latest = null;
        for (var page = 1; page <= MaxPages; page++)
        {
            using var response = await client.GetAsync(
                $"https://api.github.com/repos/Urado/CherryPlay/releases?per_page=100&page={page}",
                cancellationToken);
            response.EnsureSuccessStatusCode();
            using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
                throw new InvalidDataException("GitHub release list must be an array");

            foreach (var release in document.RootElement.EnumerateArray())
            {
                var version = TryGetVersionFromRelease(release);
                if (version is not null && (latest is null || CompareVersions(version, latest) > 0))
                    latest = version;
            }

            if (document.RootElement.GetArrayLength() < 100)
                return latest;
        }

        return latest;
    }

    private static string? TryGetVersionFromRelease(JsonElement release)
    {
        if (release.ValueKind != JsonValueKind.Object
            || !release.TryGetProperty("prerelease", out var prerelease)
            || prerelease.ValueKind is not (JsonValueKind.True or JsonValueKind.False)
            || !release.TryGetProperty("tag_name", out var tag) || tag.ValueKind != JsonValueKind.String
            || !release.TryGetProperty("assets", out var assets) || assets.ValueKind != JsonValueKind.Array)
            return null;

        if (!prerelease.GetBoolean()
            || (release.TryGetProperty("draft", out var draft) && draft.ValueKind == JsonValueKind.True))
            return null;

        var match = TagPattern.Match(tag.GetString() ?? "");
        if (!match.Success)
            return null;

        var version = $"{match.Groups[1].Value}.{match.Groups[2].Value}.{match.Groups[3].Value}";
        string[] expectedNames = [$"CherryPashkaParty-{version}-x64.zip", $"CherryPashkaList-{version}-x64.zip"];
        foreach (var asset in assets.EnumerateArray())
        {
            if (asset.ValueKind != JsonValueKind.Object
                || !asset.TryGetProperty("name", out var name) || name.ValueKind != JsonValueKind.String
                || !asset.TryGetProperty("browser_download_url", out var url) || url.ValueKind != JsonValueKind.String)
                continue;

            if (!expectedNames.Contains(name.GetString()))
                continue;

            var expectedUrl = $"https://github.com/Urado/CherryPlay/releases/download/player-v{version}/{name.GetString()}";
            if (url.GetString() == expectedUrl)
                return version;
        }

        return null;
    }

    private static int CompareVersions(string left, string right)
    {
        var leftParts = left.Split('.');
        var rightParts = right.Split('.');
        for (var index = 0; index < 3; index++)
        {
            var comparison = leftParts[index].Length.CompareTo(rightParts[index].Length);
            if (comparison == 0)
                comparison = string.CompareOrdinal(leftParts[index], rightParts[index]);
            if (comparison != 0)
                return comparison;
        }

        return 0;
    }
}
