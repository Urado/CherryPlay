namespace CherryPlayServer.Models;

public record CreateOAuthAccountResponse(
    Guid Id,
    string Email,
    string ProviderSubject
);
