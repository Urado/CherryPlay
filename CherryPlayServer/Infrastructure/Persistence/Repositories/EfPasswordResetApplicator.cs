using Microsoft.EntityFrameworkCore;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfPasswordResetApplicator : IPasswordResetApplicator
{
    private readonly AppDbContext _context;

    public EfPasswordResetApplicator(AppDbContext context)
    {
        _context = context;
    }

    public async Task<bool> ApplyAsync(Guid tokenId, Guid emailAccountId, string newPasswordHash)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var now = DateTime.UtcNow;
            var claimed = await _context.PasswordResetTokens
                .Where(e => e.Id == tokenId && e.UsedAt == null && e.ExpiresAt > now)
                .ExecuteUpdateAsync(setters => setters.SetProperty(e => e.UsedAt, now));
            if (claimed == 0)
            {
                await transaction.RollbackAsync();
                return false;
            }

            var emailAccount = await _context.EmailAccounts
                .FirstOrDefaultAsync(e => e.Id == emailAccountId);
            if (emailAccount == null)
            {
                await transaction.RollbackAsync();
                return false;
            }

            emailAccount.PasswordHash = newPasswordHash;
            emailAccount.LastUsedAt = now;

            await _context.PasswordResetTokens
                .Where(e => e.EmailAccountId == emailAccountId && e.UsedAt == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(e => e.UsedAt, now));

            await _context.OrganizerSessions
                .Where(e => e.OrganizerId == emailAccount.OrganizerId)
                .ExecuteDeleteAsync();

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
            return true;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task ApplyPasswordChangeAsync(Guid emailAccountId, Guid organizerId, string newPasswordHash)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var now = DateTime.UtcNow;
            var emailAccount = await _context.EmailAccounts
                .FirstOrDefaultAsync(e => e.Id == emailAccountId);
            if (emailAccount == null)
            {
                await transaction.RollbackAsync();
                throw new InvalidOperationException("Email account not found");
            }

            emailAccount.PasswordHash = newPasswordHash;
            emailAccount.LastUsedAt = now;

            await _context.PasswordResetTokens
                .Where(e => e.EmailAccountId == emailAccountId && e.UsedAt == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(e => e.UsedAt, now));

            await _context.OrganizerSessions
                .Where(e => e.OrganizerId == organizerId)
                .ExecuteDeleteAsync();

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}
