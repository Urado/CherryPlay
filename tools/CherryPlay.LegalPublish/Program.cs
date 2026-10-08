using System.Text.Encodings.Web;
using System.Text.Json;
using CherryPlay.LegalPublish;

var version = args.Length > 0 ? args[0] : "1.0";
if (version is "-h" or "--help")
{
    Console.WriteLine("Usage: dotnet run --project tools/CherryPlay.LegalPublish -- [version]");
    Console.WriteLine("  version  folder under content/legal, e.g. 1.0 → v1.0 (default: 1.0)");
    Console.WriteLine("Writes CherryPlayComponents/.../legal-registry.generated.json for the frontend.");
    Console.WriteLine("Postgres registry rows are applied only via EF migrations (HasData) — not by this tool.");
    return 0;
}

var repoRoot = FindRepoRoot(AppContext.BaseDirectory)
    ?? throw new InvalidOperationException("Could not locate CherryPlay repo root (CherryPlay.sln).");

var contentRoot = Path.Combine(repoRoot, "CherryPlayWeb", "src", "content", "legal");
var outJson = Path.Combine(
    repoRoot,
    "CherryPlayComponents",
    "src",
    "constants",
    "legal-registry.generated.json");

Console.WriteLine($"Publishing legal pack v{version}");

var registry = LegalRegistryBuilder.Build(contentRoot, version, DateTimeOffset.UtcNow);
foreach (var doc in registry.Documents)
{
    Console.WriteLine($"  {doc.Type}: {doc.ContentHash}");
}

var json = JsonSerializer.Serialize(
    registry,
    new JsonSerializerOptions
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    }) + "\n";

Directory.CreateDirectory(Path.GetDirectoryName(outJson)!);
File.WriteAllText(outJson, json);
Console.WriteLine($"Wrote {outJson}");
Console.WriteLine("Update legal_document_versions via EF HasData + migration if hashes/versions changed.");

return 0;

static string? FindRepoRoot(string start)
{
    var dir = new DirectoryInfo(start);
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
