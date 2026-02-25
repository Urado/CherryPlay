using Microsoft.EntityFrameworkCore;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Mappings;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

/// <summary>
/// Реализация <see cref="IStreamingRepository"/> для слоя персистентности (EF Core + PostgreSQL).
/// </summary>
public class EfStreamingRepository : IStreamingRepository
{
    private readonly AppDbContext _context;

    public EfStreamingRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PlaybackState?> GetSessionStateAsync(Guid partyId)
    {
        var ef = await _context.SessionStates
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.PartyId == partyId);
        return ef?.ToDomain().Clone();
    }

    public async Task SetSessionStateAsync(Guid partyId, PlaybackState state)
    {
        var clone = state.Clone();
        var ef = await _context.SessionStates
            .FirstOrDefaultAsync(e => e.PartyId == partyId);
        if (ef != null)
        {
            clone.ApplyTo(ef);
        }
        else
        {
            var newEf = clone.ToEf(partyId);
            _context.SessionStates.Add(newEf);
        }
        await _context.SaveChangesAsync();
    }

    public async Task DeleteSessionStateAsync(Guid partyId)
    {
        var ef = await _context.SessionStates
            .FirstOrDefaultAsync(e => e.PartyId == partyId);
        if (ef != null)
        {
            _context.SessionStates.Remove(ef);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<Dictionary<Guid, PlaybackState>> GetAllSessionStatesAsync()
    {
        var list = await _context.SessionStates
            .AsNoTracking()
            .ToListAsync();
        return list.ToDictionary(e => e.PartyId, e => e.ToDomain().Clone());
    }
}
