using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence.Mappings;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfDesktopAuthCodeRepository : IDesktopAuthCodeRepository
{
    private readonly AppDbContext _context;

    public EfDesktopAuthCodeRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<DesktopAuthCode> AddAsync(DesktopAuthCode code)
    {
        var ef = code.ToEf();
        _context.DesktopAuthCodes.Add(ef);
        await _context.SaveChangesAsync();
        return code;
    }

    public async Task<DesktopAuthCode?> GetValidByTokenHashAsync(string tokenHash)
    {
        var now = DateTime.UtcNow;
        var ef = await _context.DesktopAuthCodes
            .AsNoTracking()
            .FirstOrDefaultAsync(e =>
                e.TokenHash == tokenHash
                && e.UsedAt == null
                && e.ExpiresAt > now);
        return ef?.ToDomain();
    }

    public async Task<bool> TryMarkUsedAsync(Guid codeId)
    {
        var now = DateTime.UtcNow;
        var rows = await _context.DesktopAuthCodes
            .Where(e => e.Id == codeId && e.UsedAt == null && e.ExpiresAt > now)
            .ExecuteUpdateAsync(setters => setters.SetProperty(e => e.UsedAt, now));
        return rows > 0;
    }
}
