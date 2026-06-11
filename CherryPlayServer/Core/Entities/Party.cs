using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Entities;

public class Party
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? Subtitle { get; set; }
    public string ShortCode { get; set; } = string.Empty;
    public PartyThemeId PartyThemeId { get; set; } = PartyThemeId.Cyberpunk;
    public Dictionary<string, object>? CustomizationSettings { get; set; }
    public PartyPlaylist Playlist { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EventDateTime { get; set; }
    public DateTime? EventEndDateTime { get; set; }
    public bool IsListedInCatalog { get; set; }
    public string? Description { get; set; }
    public string? Place { get; set; }
    public string? City { get; set; }
    public string? Schedule { get; set; }
    public string? TimeZone { get; set; }
    public string? ShortDescription { get; set; }
    public string? ExternalLinkUrl { get; set; }
    public string? ExternalLinkText { get; set; }
    public List<string> DanceTags { get; set; } = [];
    public PartyLifecycleState PartyLifecycleState { get; set; } = PartyLifecycleState.Draft;
}
