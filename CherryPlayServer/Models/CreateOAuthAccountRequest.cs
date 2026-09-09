using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record CreateOAuthAccountRequest(
    OAuthProvider Provider,
    string Code,
    List<ConsentInputDto> Consents,
    string? RedirectUri = null,
    string? DeviceId = null
);
