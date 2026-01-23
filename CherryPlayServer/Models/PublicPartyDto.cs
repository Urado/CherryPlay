namespace CherryPlayServer.Models;

public class PublicPartyDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string StyleId { get; set; } = string.Empty;
    public Dictionary<string, object>? CustomizationSettings { get; set; }
    public bool HasActiveSession { get; set; }
    public string? SessionStartedAt { get; set; }
}

