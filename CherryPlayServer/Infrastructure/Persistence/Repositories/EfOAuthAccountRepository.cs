using Microsoft.EntityFrameworkCore;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence;
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

    public async Task<OAuthAccount?> GetByProviderUserIdForUpdateAsync(
        OAuthProvider provider,
        string providerUserId,
        CancellationToken cancellationToken = default)
    {
        var providerStr = provider.ToString().ToLowerInvariant();
        var lockKey = $"{providerStr}:{providerUserId}";
        await _context.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtext({lockKey}))",
            cancellationToken);

        var ef = await _context.OAuthAccounts
            .FromSqlInterpolated(
                $"SELECT * FROM oauth_accounts WHERE provider = {providerStr} AND provider_user_id = {providerUserId} FOR UPDATE")
            .AsTracking()
            .FirstOrDefaultAsync(cancellationToken);
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
        if (!await TryAddAsync(account))
        {
            throw new InvalidOperationException(
                $"OAuth account for provider {account.Provider} and user {account.ProviderUserId} already exists");
        }

        return account;
    }

    public async Task<bool> TryAddAsync(OAuthAccount account)
    {
        var providerStr = account.Provider.ToString().ToLowerInvariant();
        if (await _context.OAuthAccounts.AnyAsync(
                e => e.Provider == providerStr && e.ProviderUserId == account.ProviderUserId))
        {
            return false;
        }

        var ef = account.ToEf();
        _context.OAuthAccounts.Add(ef);
        try
        {
            await _context.SaveChangesAsync();
            return true;
        }
        catch (DbUpdateException)
        {
            _context.Entry(ef).State = EntityState.Detached;
            return false;
        }
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
