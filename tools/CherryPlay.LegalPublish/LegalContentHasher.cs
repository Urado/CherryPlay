using System.Security.Cryptography;
using System.Text;

namespace CherryPlay.LegalPublish;

/// <summary>
/// Canonical hash of a clean legal .md file: trim BOM/ends, LF newlines, UTF-8, SHA-256 lowercase hex.
/// Files must not contain YAML frontmatter.
/// </summary>
public static class LegalContentHasher
{
    public const string AlgorithmId = "sha256-lf-text";

    public static string NormalizeNewlinesToLf(string text) =>
        text.Replace("\r\n", "\n", StringComparison.Ordinal).Replace('\r', '\n');

    public static string HashText(string text)
    {
        var normalized = NormalizeNewlinesToLf(text.TrimStart('\uFEFF').Trim());
        var bytes = Encoding.UTF8.GetBytes(normalized);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
