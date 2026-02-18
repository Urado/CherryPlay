using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Entities;

public class Organizer
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public Dictionary<string, string>? Links { get; set; }
    public ThemeId? DefaultThemeId { get; set; }
    public Dictionary<string, object>? DefaultCustomizationSettings { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
