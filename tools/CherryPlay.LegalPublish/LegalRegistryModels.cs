using System.Text.Json.Serialization;

namespace CherryPlay.LegalPublish;

public sealed class LegalRegistryDocument
{
    [JsonPropertyName("type")]
    public required string Type { get; init; }

    [JsonPropertyName("versionId")]
    public required string VersionId { get; init; }

    [JsonPropertyName("documentVersion")]
    public required string DocumentVersion { get; init; }

    [JsonPropertyName("contentHash")]
    public required string ContentHash { get; init; }

    [JsonPropertyName("effectiveFrom")]
    public required string EffectiveFrom { get; init; }

    [JsonPropertyName("currentPath")]
    public required string CurrentPath { get; init; }

    [JsonPropertyName("archivePath")]
    public required string ArchivePath { get; init; }

    [JsonPropertyName("title")]
    public required string Title { get; init; }

    [JsonPropertyName("sourceFile")]
    public required string SourceFile { get; init; }
}

public sealed class LegalRegistry
{
    [JsonPropertyName("contentVersion")]
    public required string ContentVersion { get; init; }

    [JsonPropertyName("hashAlgorithm")]
    public required string HashAlgorithm { get; init; }

    [JsonPropertyName("generatedAtUtc")]
    public required string GeneratedAtUtc { get; init; }

    [JsonPropertyName("documents")]
    public required IReadOnlyList<LegalRegistryDocument> Documents { get; init; }
}
