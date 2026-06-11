using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IAdminAuditLogRepository
{
    Task AddAsync(AdminAuditLog log);
}
