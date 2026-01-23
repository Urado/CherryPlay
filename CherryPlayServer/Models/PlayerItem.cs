namespace CherryPlayServer.Models;

public class PlayerItem
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // "track" or "group"
    public string Name { get; set; } = string.Empty;
    public string? Path { get; set; }
    public int? Duration { get; set; }
    public List<PlayerItem>? Items { get; set; }
    public int DisplayOrder { get; set; }
    public int Level { get; set; }
}

