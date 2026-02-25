using Microsoft.EntityFrameworkCore;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Mappings;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

/// <summary>
/// Реализация <see cref="IOAuthAccountRepository"/> для слоя персистентности (EF Core + PostgreSQL).
/// </summary>
public class EfOAuthAccountRepository : IOAuthAccountRepository
{
    private readonly AppDbContext _context;

    public EfOAuthAccountRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<OAuthAccount?> GetByProviderUserIdAsync(OAuthProvider provider, string providerUserId)
    {
        var providerStr = provider.ToString().ToLowerInvariant();
        var ef = await _context.OAuthAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Provider == providerStr && e.ProviderUserId == providerUserId);
        return ef?.ToDomain();
    }

    public async Task<List<OAuthAccount>> GetByOrganizerIdAsync(Guid organizerId)
    {
        var list = await _context.OAuthAccounts
            .AsNoTracking()
            .Where(e => e.OrganizerId == organizerId)
            .ToListAsync();
        return list.Select(e => e.ToDomain()).ToList();
    }

    public async Task<OAuthAccount> AddAsync(OAuthAccount account)
    {
        var ef = account.ToEf();
        _context.OAuthAccounts.Add(ef);
        await _context.SaveChangesAsync();
        return account;
    }

    public async Task UpdateAsync(OAuthAccount account)
    {
        var ef = await _context.OAuthAccounts
            .FirstOrDefaultAsync(e => e.Id == account.Id);
        if (ef == null)
            return;
        account.ApplyTo(ef);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        var ef = await _context.OAuthAccounts
            .FirstOrDefaultAsync(e => e.Id == id);
        if (ef != null)
        {
            _context.OAuthAccounts.Remove(ef);
            await _context.SaveChangesAsync();
        }
    }
}
