namespace CherryPlayServer.Models;

public record PlayerItem(
    string Id,
    string Type, // "track" or "group"
    string Name,
    int DisplayOrder,
    int Level,
    string? Path = null,
    int? Duration = null,
    List<PlayerItem>? Items = null
);

