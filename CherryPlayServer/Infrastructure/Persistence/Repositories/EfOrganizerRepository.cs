using Microsoft.EntityFrameworkCore;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Mappings;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfOrganizerRepository : IOrganizerRepository
{
    private readonly AppDbContext _context;

    public EfOrganizerRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Organizer?> GetByIdAsync(Guid id, bool includeDeleted = false)
    {
        var query = _context.Organizers.AsNoTracking().Where(e => e.Id == id);
        if (includeDeleted)
        {
            query = query.IgnoreQueryFilters().Where(e => e.Id == id);
        }

        var ef = await query.FirstOrDefaultAsync();
        return ef?.ToDomain();
    }

    public async Task<Organizer?> GetByIdForUpdateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var ef = await _context.Organizers
            .FromSqlInterpolated($@"
                SELECT * FROM organizers
                WHERE id = {id} AND is_deleted = FALSE
                FOR UPDATE")
            .IgnoreQueryFilters()
            .AsTracking()
            .FirstOrDefaultAsync(cancellationToken);
        return ef?.ToDomain();
    }

    public async Task<Organizer> AddAsync(Organizer organizer)
    {
        var ef = organizer.ToEf();
        _context.Organizers.Add(ef);
        await _context.SaveChangesAsync();
        organizer.CreatedAt = ef.CreatedAt;
        return organizer;
    }

    public async Task UpdateAsync(Organizer organizer)
    {
        var ef = await _context.Organizers
            .FirstOrDefaultAsync(e => e.Id == organizer.Id && !e.IsDeleted);
        if (ef == null)
            return;
        organizer.ApplyTo(ef);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        var ef = await _context.Organizers
            .FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted);
        if (ef == null)
            return;
        ef.IsDeleted = true;
        await _context.SaveChangesAsync();
    }
}
