using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Entities;

public class OrganizerEntitlement
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public Guid PackageId { get; set; }
    public EntitlementKind Kind { get; set; } = EntitlementKind.Lifetime;
    public EntitlementSource Source { get; set; } = EntitlementSource.AdminGrant;
    public DateTime GrantedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int? UsesRemaining { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? Note { get; set; }

    public static OrganizerEntitlement CreateAdminGrant(Guid entitlementId, Guid organizerId, Guid packageId, DateTime grantedAt, string? note) => new()
    {
        Id = entitlementId,
        OrganizerId = organizerId,
        PackageId = packageId,
        Kind = EntitlementKind.Lifetime,
        Source = EntitlementSource.AdminGrant,
        GrantedAt = grantedAt,
        Note = note
    };
}
