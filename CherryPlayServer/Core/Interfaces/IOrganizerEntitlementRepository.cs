using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IOrganizerEntitlementRepository
{
    Task<List<OrganizerEntitlement>> GetByOrganizerIdAsync(Guid organizerId);
    Task<OrganizerEntitlement?> GetByIdAsync(Guid entitlementId);
    Task<OrganizerEntitlement?> GetActiveByOrganizerAndPackageAsync(Guid organizerId, Guid packageId);
    Task AddAsync(OrganizerEntitlement entitlement);
    Task UpdateAsync(OrganizerEntitlement entitlement);
}
