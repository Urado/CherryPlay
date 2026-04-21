namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class AdminAuditLogEf
{
    public Guid Id { get; set; }
    public Guid AdminId { get; set; }
    public string Action { get; set; } = string.Empty;
    public Guid? TargetOrganizerId { get; set; }
    public Guid? PackageId { get; set; }
    public Guid? EntitlementId { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}
