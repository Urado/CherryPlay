using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Entities;

public class Theme
{
    public string ThemeId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ThemeVisibility Visibility { get; set; } = ThemeVisibility.Public;
}
