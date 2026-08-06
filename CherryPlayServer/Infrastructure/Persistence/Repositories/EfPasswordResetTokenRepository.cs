using Microsoft.EntityFrameworkCore;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence.Mappings;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfPasswordResetTokenRepository : IPasswordResetTokenRepository
{
    private readonly AppDbContext _context;

    public EfPasswordResetTokenRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PasswordResetToken> AddAsync(PasswordResetToken token)
    {
        var ef = token.ToEf();
        _context.PasswordResetTokens.Add(ef);
        await _context.SaveChangesAsync();
        return token;
    }

    public async Task<PasswordResetToken?> GetValidByTokenHashAsync(string tokenHash)
    {
        var now = DateTime.UtcNow;
        var ef = await _context.PasswordResetTokens
            .AsNoTracking()
            .FirstOrDefaultAsync(e =>
                e.TokenHash == tokenHash
                && e.UsedAt == null
                && e.ExpiresAt > now);
        return ef?.ToDomain();
    }

    public async Task InvalidateUnusedByEmailAccountIdAsync(Guid emailAccountId)
    {
        var now = DateTime.UtcNow;
        await _context.PasswordResetTokens
            .Where(e => e.EmailAccountId == emailAccountId && e.UsedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(e => e.UsedAt, now));
    }

    public async Task<bool> TryMarkUsedAsync(Guid tokenId)
    {
        var now = DateTime.UtcNow;
        var rows = await _context.PasswordResetTokens
            .Where(e => e.Id == tokenId && e.UsedAt == null && e.ExpiresAt > now)
            .ExecuteUpdateAsync(setters => setters.SetProperty(e => e.UsedAt, now));
        return rows > 0;
    }

    public async Task<bool> TryUnmarkUsedAsync(Guid tokenId)
    {
        var rows = await _context.PasswordResetTokens
            .Where(e => e.Id == tokenId && e.UsedAt != null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(e => e.UsedAt, (DateTime?)null));
        return rows > 0;
    }
}
