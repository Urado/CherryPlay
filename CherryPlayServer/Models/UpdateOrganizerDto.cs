namespace CherryPlayServer.Models;

public record UpdateOrganizerDto(
    string? Name,
    string? LogoUrl,
    Dictionary<string, string>? Links,
    string? TimeZone
);
