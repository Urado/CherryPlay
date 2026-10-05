using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IAdminQueryService
{
    Task<IReadOnlyList<AdminThemePackageView>> GetPackagesAsync();
    Task<AdminOrganizerListView> GetOrganizersAsync(string? query, int page, int pageSize);
    Task<AdminOrganizerDetailView?> GetOrganizerAsync(Guid organizerId);
    Task<bool> OrganizerExistsAsync(Guid organizerId);
    Task<IReadOnlyList<AdminEntitlement>> GetOrganizerEntitlementsAsync(Guid organizerId, bool activeOnly);
}
