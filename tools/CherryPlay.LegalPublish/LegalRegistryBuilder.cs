using System.Text.Json;
using System.Text.Json.Serialization;

namespace CherryPlay.LegalPublish;

public static class LegalRegistryBuilder
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public static LegalRegistry Build(string contentRoot, string version, DateTimeOffset generatedAtUtc)
    {
        var folderName = $"v{version}";
        var versionDir = Path.Combine(contentRoot, folderName);
        if (!Directory.Exists(versionDir))
        {
            throw new DirectoryNotFoundException($"Legal content folder not found: {versionDir}");
        }

        var manifestPath = Path.Combine(versionDir, "manifest.json");
        if (!File.Exists(manifestPath))
        {
            throw new FileNotFoundException($"Missing legal manifest: {manifestPath}");
        }

        var manifest = JsonSerializer.Deserialize<LegalPackManifest>(
            File.ReadAllText(manifestPath),
            JsonOptions)
            ?? throw new InvalidOperationException($"Invalid manifest: {manifestPath}");

        if (manifest.Documents.Count == 0)
        {
            throw new InvalidOperationException($"{manifestPath}: documents list is empty.");
        }

        var documentVersion = string.IsNullOrWhiteSpace(manifest.DocumentVersion)
            ? version
            : manifest.DocumentVersion;
        var effectiveFrom = string.IsNullOrWhiteSpace(manifest.EffectiveFrom)
            ? throw new InvalidOperationException($"{manifestPath}: missing effectiveFrom.")
            : manifest.EffectiveFrom;

        var documents = new List<LegalRegistryDocument>(manifest.Documents.Count);
        foreach (var entry in manifest.Documents)
        {
            if (string.IsNullOrWhiteSpace(entry.File)
                || string.IsNullOrWhiteSpace(entry.Type)
                || string.IsNullOrWhiteSpace(entry.VersionId)
                || string.IsNullOrWhiteSpace(entry.CurrentPath)
                || string.IsNullOrWhiteSpace(entry.Title))
            {
                throw new InvalidOperationException(
                    $"{manifestPath}: each document needs file, type, versionId, currentPath, title.");
            }

            if (!Guid.TryParse(entry.VersionId, out _))
            {
                throw new FormatException($"{manifestPath}: versionId must be a GUID ({entry.File}).");
            }

            var path = Path.Combine(versionDir, entry.File);
            if (!File.Exists(path))
            {
                throw new FileNotFoundException($"Missing legal markdown: {path}");
            }

            var text = File.ReadAllText(path);
            if (text.TrimStart('\uFEFF').TrimStart().StartsWith("---", StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    $"{path}: legal .md must be plain text without YAML frontmatter.");
            }

            documents.Add(new LegalRegistryDocument
            {
                Type = entry.Type,
                VersionId = entry.VersionId,
                DocumentVersion = documentVersion,
                ContentHash = LegalContentHasher.HashText(text),
                EffectiveFrom = effectiveFrom,
                CurrentPath = entry.CurrentPath,
                ArchivePath = $"{entry.CurrentPath}/v/{documentVersion}",
                Title = entry.Title,
                SourceFile = $"{folderName}/{entry.File}",
            });
        }

        return new LegalRegistry
        {
            ContentVersion = version,
            HashAlgorithm = LegalContentHasher.AlgorithmId,
            GeneratedAtUtc = generatedAtUtc.UtcDateTime.ToString("O"),
            Documents = documents,
        };
    }

    private sealed class LegalPackManifest
    {
        [JsonPropertyName("documentVersion")]
        public string DocumentVersion { get; init; } = "";

        [JsonPropertyName("effectiveFrom")]
        public string EffectiveFrom { get; init; } = "";

        [JsonPropertyName("documents")]
        public List<LegalManifestDocument> Documents { get; init; } = [];
    }

    private sealed class LegalManifestDocument
    {
        [JsonPropertyName("file")]
        public string File { get; init; } = "";

        [JsonPropertyName("type")]
        public string Type { get; init; } = "";

        [JsonPropertyName("versionId")]
        public string VersionId { get; init; } = "";

        [JsonPropertyName("currentPath")]
        public string CurrentPath { get; init; } = "";

        [JsonPropertyName("title")]
        public string Title { get; init; } = "";
    }
}
