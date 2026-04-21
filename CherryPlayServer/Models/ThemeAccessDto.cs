namespace CherryPlayServer.Models;

public record ThemeAccessDto(
    List<string> GrantedThemeIds,
    List<VisibleLockedThemeDto> VisibleLockedThemes,
    string ContactUrl);

public record VisibleLockedThemeDto(string ThemeId, string PackageCode, string PackageName);
