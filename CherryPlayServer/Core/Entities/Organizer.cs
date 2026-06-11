using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Entities;

public class Organizer
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public Dictionary<string, string>? Links { get; set; }
    /// <summary>
    /// PartyTheme по умолчанию (см. GLOSSARY.md)
    /// </summary>
    public PartyThemeId? DefaultPartyThemeId { get; set; }
    public Dictionary<string, object>? DefaultCustomizationSettings { get; set; }
    public string? TimeZone { get; set; }
    public OrganizerRole Role { get; set; } = OrganizerRole.Organizer;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
