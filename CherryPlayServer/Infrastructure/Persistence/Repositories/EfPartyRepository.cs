using Microsoft.EntityFrameworkCore;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Mappings;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

/// <summary>
/// Реализация <see cref="IPartyRepository"/> для слоя персистентности (EF Core + PostgreSQL).
/// Инкапсулирует доступ к данным; возвращает только доменные сущности из Core.
/// </summary>
public class EfPartyRepository : IPartyRepository
{
    private readonly AppDbContext _context;

    public EfPartyRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Party?> GetByIdAsync(Guid id)
    {
        var ef = await _context.Parties
            .AsNoTracking()
            .Include(e => e.Playlist)
            .FirstOrDefaultAsync(e => e.Id == id);
        return ef?.ToDomain();
    }

    public async Task<Party?> GetByShortCodeAsync(string shortCode)
    {
        var ef = await _context.Parties
            .AsNoTracking()
            .Include(e => e.Playlist)
            .FirstOrDefaultAsync(e => e.ShortCode == shortCode);
        return ef?.ToDomain();
    }

    public async Task<List<Party>> GetAllAsync()
    {
        var list = await _context.Parties
            .AsNoTracking()
            .Include(e => e.Playlist)
            .OrderBy(e => e.CreatedAt)
            .ToListAsync();
        return list.Select(e => e.ToDomain()).ToList();
    }

    public async Task<List<Party>> GetByOrganizerIdAsync(Guid organizerId)
    {
        var list = await _context.Parties
            .AsNoTracking()
            .Include(e => e.Playlist)
            .Where(e => e.OrganizerId == organizerId)
            .OrderBy(e => e.CreatedAt)
            .ToListAsync();
        return list.Select(e => e.ToDomain()).ToList();
    }

    public async Task<Party> AddAsync(Party party)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var partyEf = party.ToEf();
            _context.Parties.Add(partyEf);
            await _context.SaveChangesAsync();

            var playlistEf = party.Playlist.ToEf(party.Id);
            _context.PartyPlaylists.Add(playlistEf);
            await _context.SaveChangesAsync();

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
        return party;
    }

    public async Task UpdateAsync(Party party)
    {
        var ef = await _context.Parties
            .Include(e => e.Playlist)
            .FirstOrDefaultAsync(e => e.Id == party.Id);
        if (ef == null)
            return;

        party.ApplyTo(ef);
        if (ef.Playlist != null)
        {
            ef.Playlist.Items = party.Playlist.Items;
            ef.Playlist.TotalDuration = party.Playlist.TotalDuration;
            ef.Playlist.TotalTracks = party.Playlist.TotalTracks;
            ef.Playlist.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _context.PartyPlaylists.Add(party.Playlist.ToEf(party.Id));
        }

        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        var ef = await _context.Parties
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(e => e.Id == id);
        if (ef == null)
            return;
        ef.IsDeleted = true;
        await _context.SaveChangesAsync();
    }

    public async Task<Party?> GetFirstAsync()
    {
        var ef = await _context.Parties
            .AsNoTracking()
            .Include(e => e.Playlist)
            .FirstOrDefaultAsync();
        return ef?.ToDomain();
    }
}
