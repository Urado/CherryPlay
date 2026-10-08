using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Services;

public class AdminQueryService(IAdminQueryRepository repository) : IAdminQueryService
{
    public Task<IReadOnlyList<AdminThemePackageView>> GetPackagesAsync() => repository.GetPackagesAsync();

    public Task<AdminOrganizerListView> GetOrganizersAsync(string? query, int page, int pageSize) =>
        repository.GetOrganizersAsync(query, Math.Max(page, 1), Math.Clamp(pageSize, 1, 100));

    public Task<AdminOrganizerDetailView?> GetOrganizerAsync(Guid organizerId) => repository.GetOrganizerAsync(organizerId);

    public Task<bool> OrganizerExistsAsync(Guid organizerId) => repository.OrganizerExistsAsync(organizerId);

    public Task<IReadOnlyList<AdminEntitlement>> GetOrganizerEntitlementsAsync(Guid organizerId, bool activeOnly) =>
        repository.GetOrganizerEntitlementsAsync(organizerId, activeOnly);
}
