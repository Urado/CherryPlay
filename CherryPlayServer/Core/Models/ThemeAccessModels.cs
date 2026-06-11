namespace CherryPlayServer.Core.Models;

public record ThemeAccessSummary(
    List<string> GrantedThemeIds,
    List<LockedThemeInfo> VisibleLockedThemes,
    string ContactUrl);

public record LockedThemeInfo(string ThemeId, string PackageCode, string PackageName);

public record ThemeAccessCheckResult(
    bool IsAllowed,
    bool IsThemeVisible,
    List<string> RequiredPackageCodes);
