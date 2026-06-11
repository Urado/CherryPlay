using System.Linq.Expressions;
using CherryPlayServer.Infrastructure.Persistence.Entities;

namespace CherryPlayServer.Infrastructure.Persistence.Queries;

public static class OrganizerEntitlementPredicates
{
    public static Expression<Func<OrganizerEntitlementEf, bool>> IsActive(DateTime nowUtc)
    {
        return entitlement =>
            entitlement.RevokedAt == null &&
            (entitlement.ExpiresAt == null || entitlement.ExpiresAt > nowUtc) &&
            (entitlement.UsesRemaining == null || entitlement.UsesRemaining > 0);
    }
}
