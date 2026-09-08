using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IOrganizersService
{
    Task<RegisterOrganizerResponse> RegisterAsync(RegisterOrganizerRequest request, CancellationToken cancellationToken = default);
}
