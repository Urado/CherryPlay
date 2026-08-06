using Microsoft.EntityFrameworkCore;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
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

    public async Task<EmailAccount?> GetByOrganizerIdAsync(Guid organizerId)
    {
        var ef = await _context.EmailAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.OrganizerId == organizerId);
        return ef?.ToDomain();
    }

    public async Task<EmailAccount> AddAsync(EmailAccount account)
    {
        if (string.IsNullOrWhiteSpace(account.Email))
            throw new ArgumentException("Email cannot be empty", nameof(account));
        var normalizedEmail = account.Email.ToLowerInvariant().Trim();
        if (await _context.EmailAccounts.AnyAsync(e => e.Email == normalizedEmail))
            throw new InvalidOperationException($"Email {account.Email} is already registered");
        var ef = account.ToEf();
        ef.Email = normalizedEmail;
        _context.EmailAccounts.Add(ef);
        await _context.SaveChangesAsync();
        return account;
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
}
