namespace CherryPlayServer.Models;

public record AuthExchangeRequest(
    string Code,
    string Provider,
    string? DeviceId = null,
    string? State = null
);
