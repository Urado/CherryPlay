using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Utils;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryOrganizerEntitlementRepository : IOrganizerEntitlementRepository
{
    private readonly ConcurrentDictionary<Guid, OrganizerEntitlement> _entitlements = new();

    public Task<List<OrganizerEntitlement>> GetByOrganizerIdAsync(Guid organizerId)
    {
        var items = _entitlements.Values
            .Where(x => x.OrganizerId == organizerId)
            .Select(Clone)
            .ToList();
        return Task.FromResult(items);
    }

    public Task<OrganizerEntitlement?> GetByIdAsync(Guid entitlementId)
    {
        _entitlements.TryGetValue(entitlementId, out var entitlement);
        return Task.FromResult(entitlement is null ? null : Clone(entitlement));
    }

    public Task<OrganizerEntitlement?> GetActiveByOrganizerAndPackageAsync(Guid organizerId, Guid packageId)
    {
        var now = DateTime.UtcNow;
        var item = _entitlements.Values.FirstOrDefault(x =>
            x.OrganizerId == organizerId &&
            x.PackageId == packageId &&
            EntitlementRules.IsActiveAt(x, now));
        return Task.FromResult(item is null ? null : Clone(item));
    }

    public Task AddAsync(OrganizerEntitlement entitlement)
    {
        _entitlements[entitlement.Id] = Clone(entitlement);
        return Task.CompletedTask;
    }

    public Task UpdateAsync(OrganizerEntitlement entitlement)
    {
        _entitlements[entitlement.Id] = Clone(entitlement);
        return Task.CompletedTask;
    }

    private static OrganizerEntitlement Clone(OrganizerEntitlement source) => new()
    {
        Id = source.Id,
        OrganizerId = source.OrganizerId,
        PackageId = source.PackageId,
        Kind = source.Kind,
        Source = source.Source,
        GrantedAt = source.GrantedAt,
        ExpiresAt = source.ExpiresAt,
        UsesRemaining = source.UsesRemaining,
        RevokedAt = source.RevokedAt,
        Note = source.Note,
    };
}
