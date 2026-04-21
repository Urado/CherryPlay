using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryAdminAuditLogRepository : IAdminAuditLogRepository
{
    private readonly ConcurrentBag<AdminAuditLog> _logs = [];

    public Task AddAsync(AdminAuditLog log)
    {
        _logs.Add(log);
        return Task.CompletedTask;
    }
}
