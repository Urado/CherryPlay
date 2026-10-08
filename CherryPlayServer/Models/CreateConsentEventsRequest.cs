namespace CherryPlayServer.Models;

public record CreateConsentEventsRequest(
    List<ConsentInputDto> Events
);
