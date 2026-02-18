using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Entities;

public class Party
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ShortCode { get; set; } = string.Empty;
    public ThemeId ThemeId { get; set; } = ThemeId.Cyberpunk;
    public Dictionary<string, object>? CustomizationSettings { get; set; }
    public PartyPlaylist Playlist { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EventDateTime { get; set; }
}
