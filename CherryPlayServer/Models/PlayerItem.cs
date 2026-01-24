namespace CherryPlayServer.Models;

public record PlayerItem(
    string Id,
    string Type, // "track" or "group"
    string Name,
    int DisplayOrder,
    int Level,
    int? Duration = null,
    List<PlayerItem>? Items = null
);

