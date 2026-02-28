using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Entities;

public class Party
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>Optional display title; frontend uses Title ?? Name.</summary>
    public string? Title { get; set; }
    /// <summary>Optional subtitle shown below the display title.</summary>
    public string? Subtitle { get; set; }
    public string ShortCode { get; set; } = string.Empty;
    /// <summary>
    /// PartyTheme идентификатор (см. GLOSSARY.md)
    /// </summary>
    public PartyThemeId PartyThemeId { get; set; } = PartyThemeId.Cyberpunk;
    public Dictionary<string, object>? CustomizationSettings { get; set; }
    public PartyPlaylist Playlist { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EventDateTime { get; set; }
    public bool IsListedInCatalog { get; set; }
    public string? Description { get; set; }
    public string? Place { get; set; }
    public string? City { get; set; }
    public string? Schedule { get; set; }
    public string? TimeZone { get; set; }
}
