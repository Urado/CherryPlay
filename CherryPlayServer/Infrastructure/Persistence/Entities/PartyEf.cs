namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class PartyEf
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? Subtitle { get; set; }
    public string ShortCode { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Place { get; set; }
    public string? City { get; set; }
    public DateTime? EventDateTime { get; set; }
    public string? Schedule { get; set; }
    public string? TimeZone { get; set; }
    public string PartyThemeId { get; set; } = string.Empty;
    public string? CustomizationSettingsJson { get; set; }
    public bool IsListedInCatalog { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }

    public OrganizerEf Organizer { get; set; } = null!;
    public PartyPlaylistEf? Playlist { get; set; }
    public SessionStateEf? SessionState { get; set; }
}
