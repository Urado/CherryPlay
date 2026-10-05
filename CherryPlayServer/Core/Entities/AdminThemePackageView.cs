namespace CherryPlayServer.Core.Entities;

public record AdminThemePackageView(Guid Id, string Code, string Name, bool IsAutoGranted, bool IsActive, IReadOnlyList<string> ThemeIds);
