using System.Text.RegularExpressions;

namespace CherryPlayServer.Core;

public static partial class SemverComparer
{
    [GeneratedRegex(@"^[vV]?(\d+)\.(\d+)\.(\d+)$", RegexOptions.CultureInvariant)]
    private static partial Regex SemverPattern();

    public static bool TryParse(string? version, out VersionTriple parsed)
    {
        parsed = default;
        if (string.IsNullOrWhiteSpace(version))
            return false;

        var match = SemverPattern().Match(version.Trim());
        if (!match.Success)
            return false;

        if (!int.TryParse(match.Groups[1].Value, out var major)
            || !int.TryParse(match.Groups[2].Value, out var minor)
            || !int.TryParse(match.Groups[3].Value, out var patch))
        {
            return false;
        }

        parsed = new VersionTriple(major, minor, patch);
        return true;
    }

    public static int Compare(VersionTriple left, VersionTriple right)
    {
        if (left.Major != right.Major)
            return left.Major.CompareTo(right.Major);
        if (left.Minor != right.Minor)
            return left.Minor.CompareTo(right.Minor);
        return left.Patch.CompareTo(right.Patch);
    }

    /// <summary>Compares only major and minor components (patch is ignored).</summary>
    public static int CompareMajorMinor(VersionTriple left, VersionTriple right)
    {
        if (left.Major != right.Major)
            return left.Major.CompareTo(right.Major);
        return left.Minor.CompareTo(right.Minor);
    }

    public static int Compare(string left, string right)
    {
        if (!TryParse(left, out var leftParsed))
            throw new ArgumentException($"Invalid semver: {left}", nameof(left));
        if (!TryParse(right, out var rightParsed))
            throw new ArgumentException($"Invalid semver: {right}", nameof(right));
        return Compare(leftParsed, rightParsed);
    }

    public readonly record struct VersionTriple(int Major, int Minor, int Patch);
}
