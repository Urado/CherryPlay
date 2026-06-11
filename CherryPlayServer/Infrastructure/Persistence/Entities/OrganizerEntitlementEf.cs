namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class OrganizerEntitlementEf
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public Guid PackageId { get; set; }
    public string Kind { get; set; } = "lifetime";
    public string Source { get; set; } = "admin_grant";
    public DateTime GrantedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int? UsesRemaining { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? Note { get; set; }
}
