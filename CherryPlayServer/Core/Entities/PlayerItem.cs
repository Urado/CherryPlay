using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Entities;

public class PlayerItem
{
    public string Id { get; set; } = string.Empty;
    public PlayerItemType Type { get; set; }
    public string Name { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public int Level { get; set; }
    public int? Duration { get; set; }
    public List<PlayerItem>? Items { get; set; }
}
