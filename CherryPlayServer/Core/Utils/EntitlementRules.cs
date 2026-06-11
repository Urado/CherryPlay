using CherryPlayServer.Core.Entities;
using CherryPlayServer.Infrastructure.Persistence.Entities;

namespace CherryPlayServer.Core.Utils;

public static class EntitlementRules
{
    public static bool IsActiveAt(DateTime? revokedAt, DateTime? expiresAt, int? usesRemaining, DateTime nowUtc)
    {
        return revokedAt == null &&
               (expiresAt == null || expiresAt > nowUtc) &&
               (usesRemaining == null || usesRemaining > 0);
    }

    public static bool IsActiveAt(OrganizerEntitlement entitlement, DateTime nowUtc)
        => IsActiveAt(entitlement.RevokedAt, entitlement.ExpiresAt, entitlement.UsesRemaining, nowUtc);

    public static bool IsActiveAt(OrganizerEntitlementEf entitlement, DateTime nowUtc)
        => IsActiveAt(entitlement.RevokedAt, entitlement.ExpiresAt, entitlement.UsesRemaining, nowUtc);
}
