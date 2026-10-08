using Microsoft.EntityFrameworkCore;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Mappings;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfEmailAccountRepository : IEmailAccountRepository
{
    private readonly AppDbContext _context;

    public EfEmailAccountRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<EmailAccount?> GetByIdAsync(Guid id)
    {
        var ef = await _context.EmailAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id);
        return ef?.ToDomain();
    }

    public async Task<EmailAccount?> GetByEmailAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return null;
        var ef = await _context.EmailAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Email == email.ToLowerInvariant().Trim());
        return ef?.ToDomain();
    }

    public async Task<EmailAccount?> GetByEmailForUpdateAsync(
        string email,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var normalizedEmail = email.ToLowerInvariant().Trim();
        await _context.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtext({normalizedEmail}))",
            cancellationToken);

        var ef = await _context.EmailAccounts
            .FromSqlInterpolated(
                $"SELECT * FROM email_accounts WHERE email = {normalizedEmail} FOR UPDATE")
            .AsTracking()
            .FirstOrDefaultAsync(cancellationToken);
        return ef?.ToDomain();
    }

    public async Task<EmailAccount?> GetByOrganizerIdAsync(Guid organizerId)
    {
        var ef = await _context.EmailAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.OrganizerId == organizerId);
        return ef?.ToDomain();
    }

    public async Task<EmailAccount> AddAsync(EmailAccount account)
    {
        if (!await TryAddAsync(account))
            throw new InvalidOperationException($"Email {account.Email} is already registered");
        return account;
    }

    public async Task<bool> TryAddAsync(EmailAccount account)
    {
        if (string.IsNullOrWhiteSpace(account.Email))
            throw new ArgumentException("Email cannot be empty", nameof(account));
        var normalizedEmail = account.Email.ToLowerInvariant().Trim();
        if (await _context.EmailAccounts.AnyAsync(e => e.Email == normalizedEmail))
            return false;
        var ef = account.ToEf();
        ef.Email = normalizedEmail;
        _context.EmailAccounts.Add(ef);
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

    public async Task UpdateAsync(EmailAccount account)
    {
        var ef = await _context.EmailAccounts
            .FirstOrDefaultAsync(e => e.Id == account.Id);
        if (ef == null)
            throw new InvalidOperationException($"EmailAccount with id {account.Id} not found");
        var normalizedEmail = account.Email.ToLowerInvariant().Trim();
        if (ef.Email != normalizedEmail && await _context.EmailAccounts.AnyAsync(e => e.Email == normalizedEmail))
            throw new InvalidOperationException($"Email {account.Email} is already registered");
        account.ApplyTo(ef);
        ef.Email = normalizedEmail;
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        var ef = await _context.EmailAccounts.FirstOrDefaultAsync(e => e.Id == id);
        if (ef is null)
        {
            return;
        }

        _context.EmailAccounts.Remove(ef);
        await _context.SaveChangesAsync();
    }
}
