namespace CherryPlayServer.Models;

public record RegisterOrganizerRequest(
    string Email,
    string Password,
    string Name,
    List<ConsentInputDto> Consents
);
