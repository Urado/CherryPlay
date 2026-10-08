using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IOAuthAccountsService
{
    Task<CreateOAuthAccountResponse> CreateAsync(CreateOAuthAccountRequest request, CancellationToken cancellationToken = default);
}
