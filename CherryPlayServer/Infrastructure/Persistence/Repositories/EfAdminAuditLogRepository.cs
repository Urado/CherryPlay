using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfAdminAuditLogRepository : IAdminAuditLogRepository
{
    private readonly AppDbContext _context;

    public EfAdminAuditLogRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(AdminAuditLog log)
    {
        _context.AdminAuditLogs.Add(new Persistence.Entities.AdminAuditLogEf
        {
            Id = log.Id,
            AdminId = log.AdminId,
            Action = log.Action == AdminAuditAction.RevokePackage ? "revoke_package" : "grant_package",
            TargetOrganizerId = log.TargetOrganizerId,
            PackageId = log.PackageId,
            EntitlementId = log.EntitlementId,
            Note = log.Note,
            CreatedAt = log.CreatedAt
        });
        await _context.SaveChangesAsync();
    }
}
