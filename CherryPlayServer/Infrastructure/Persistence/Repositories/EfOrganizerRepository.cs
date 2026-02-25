using Microsoft.EntityFrameworkCore;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Mappings;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

/// <summary>
/// Реализация <see cref="IOrganizerRepository"/> для слоя персистентности (EF Core + PostgreSQL).
/// </summary>
public class EfOrganizerRepository : IOrganizerRepository
{
    private readonly AppDbContext _context;

    public EfOrganizerRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Organizer?> GetByIdAsync(Guid id)
    {
        var ef = await _context.Organizers
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id);
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
            .FirstOrDefaultAsync(e => e.Id == organizer.Id);
        if (ef == null)
            return;
        organizer.ApplyTo(ef);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        var ef = await _context.Organizers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Id == id);
        if (ef == null)
            return;
        ef.IsDeleted = true;
        await _context.SaveChangesAsync();
    }
}
