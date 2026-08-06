using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryPasswordResetApplicator : IPasswordResetApplicator
{
    private readonly IPasswordResetTokenRepository _tokenRepository;
    private readonly IEmailAccountRepository _emailAccountRepository;
    private readonly IOrganizerSessionRepository _sessionRepository;

    public InMemoryPasswordResetApplicator(
        IPasswordResetTokenRepository tokenRepository,
        IEmailAccountRepository emailAccountRepository,
        IOrganizerSessionRepository sessionRepository)
    {
        _tokenRepository = tokenRepository;
        _emailAccountRepository = emailAccountRepository;
        _sessionRepository = sessionRepository;
    }

    public async Task<bool> ApplyAsync(Guid tokenId, Guid emailAccountId, string newPasswordHash)
    {
        var claimed = await _tokenRepository.TryMarkUsedAsync(tokenId);
        if (!claimed)
        {
            return false;
        }

        var emailAccount = await _emailAccountRepository.GetByIdAsync(emailAccountId);
        if (emailAccount == null)
        {
            await _tokenRepository.TryUnmarkUsedAsync(tokenId);
            return false;
        }

        var previousHash = emailAccount.PasswordHash;
        var previousLastUsed = emailAccount.LastUsedAt;

        try
        {
            emailAccount.PasswordHash = newPasswordHash;
            emailAccount.LastUsedAt = DateTime.UtcNow;
            await _emailAccountRepository.UpdateAsync(emailAccount);
            await _tokenRepository.InvalidateUnusedByEmailAccountIdAsync(emailAccountId);
            await _sessionRepository.RemoveAllByOrganizerIdAsync(emailAccount.OrganizerId);
            return true;
        }
        catch
        {
            emailAccount.PasswordHash = previousHash;
            emailAccount.LastUsedAt = previousLastUsed;
            await _emailAccountRepository.UpdateAsync(emailAccount);
            await _tokenRepository.TryUnmarkUsedAsync(tokenId);
            throw;
        }
    }

    public async Task ApplyPasswordChangeAsync(Guid emailAccountId, Guid organizerId, string newPasswordHash)
    {
        var emailAccount = await _emailAccountRepository.GetByIdAsync(emailAccountId);
        if (emailAccount == null)
        {
            throw new InvalidOperationException("Email account not found");
        }

        var previousHash = emailAccount.PasswordHash;
        var previousLastUsed = emailAccount.LastUsedAt;

        emailAccount.PasswordHash = newPasswordHash;
        emailAccount.LastUsedAt = DateTime.UtcNow;
        await _emailAccountRepository.UpdateAsync(emailAccount);

        try
        {
            await _tokenRepository.InvalidateUnusedByEmailAccountIdAsync(emailAccountId);
            await _sessionRepository.RemoveAllByOrganizerIdAsync(organizerId);
        }
        catch
        {
            emailAccount.PasswordHash = previousHash;
            emailAccount.LastUsedAt = previousLastUsed;
            await _emailAccountRepository.UpdateAsync(emailAccount);
            throw;
        }
    }
}
