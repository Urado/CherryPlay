using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Interfaces;

public interface IOAuthAccountRepository
{
    Task<OAuthAccount?> GetByProviderUserIdAsync(OAuthProvider provider, string providerUserId);
    Task<List<OAuthAccount>> GetByOrganizerIdAsync(Guid organizerId);
    Task<OAuthAccount> AddAsync(OAuthAccount account);
    Task UpdateAsync(OAuthAccount account);
    Task DeleteAsync(Guid id);
}
