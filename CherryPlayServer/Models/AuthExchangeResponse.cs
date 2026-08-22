namespace CherryPlayServer.Models;

public record AuthExchangeResponse(
    string AccessToken,
    string? Code = null
);
