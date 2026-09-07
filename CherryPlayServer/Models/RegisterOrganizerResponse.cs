namespace CherryPlayServer.Models;

public record RegisterOrganizerResponse(
    Guid Id,
    string Email,
    string Name
);
