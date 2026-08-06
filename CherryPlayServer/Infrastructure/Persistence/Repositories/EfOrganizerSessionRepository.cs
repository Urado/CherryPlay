using Microsoft.EntityFrameworkCore;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence.Mappings;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfOrganizerSessionRepository : IOrganizerSessionRepository
{
    private readonly AppDbContext _context;

    public EfOrganizerSessionRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<OrganizerSession?> GetByIdAsync(Guid sessionId)
    {
        var ef = await _context.OrganizerSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == sessionId);
        return ef?.ToDomain();
    }

    public async Task<OrganizerSession> AddAsync(OrganizerSession session)
    {
        var ef = session.ToEf();
        _context.OrganizerSessions.Add(ef);
        await _context.SaveChangesAsync();
        return session;
    }

    public async Task RemoveAsync(Guid sessionId)
    {
        var ef = await _context.OrganizerSessions
            .FirstOrDefaultAsync(e => e.Id == sessionId);
        if (ef != null)
        {
            _context.OrganizerSessions.Remove(ef);
            await _context.SaveChangesAsync();
        }
    }

    public async Task RemoveAllByOrganizerIdAsync(Guid organizerId)
    {
        await _context.OrganizerSessions
            .Where(e => e.OrganizerId == organizerId)
            .ExecuteDeleteAsync();
    }
}
