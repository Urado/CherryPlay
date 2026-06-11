using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Entities;

public class AdminAuditLog
{
    public Guid Id { get; set; }
    public Guid AdminId { get; set; }
    public AdminAuditAction Action { get; set; }
    public Guid? TargetOrganizerId { get; set; }
    public Guid? PackageId { get; set; }
    public Guid? EntitlementId { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}
