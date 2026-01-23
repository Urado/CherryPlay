namespace CherryPlayServer.Models;

public class Party
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ShortCode { get; set; } = string.Empty;
    public string StyleId { get; set; } = "cyberpunk";
    public Dictionary<string, object>? CustomizationSettings { get; set; }
    public PartyPlaylistDto Playlist { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EventDateTime { get; set; }
}

