using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IPasswordResetTokenRepository
{
    Task<PasswordResetToken> AddAsync(PasswordResetToken token);
    Task<PasswordResetToken?> GetValidByTokenHashAsync(string tokenHash);
    Task InvalidateUnusedByEmailAccountIdAsync(Guid emailAccountId);
    Task<bool> TryMarkUsedAsync(Guid tokenId);
    Task<bool> TryUnmarkUsedAsync(Guid tokenId);
}
