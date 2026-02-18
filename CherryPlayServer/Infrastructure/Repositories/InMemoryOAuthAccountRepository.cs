using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryOAuthAccountRepository : IOAuthAccountRepository
{
    private readonly ConcurrentDictionary<Guid, OAuthAccount> _accounts = new();
    private readonly ConcurrentDictionary<(OAuthProvider Provider, string ProviderUserId), Guid> _providerIndex =
        new();

    public Task<OAuthAccount?> GetByProviderUserIdAsync(OAuthProvider provider, string providerUserId)
    {
        var key = (provider, providerUserId);
        if (_providerIndex.TryGetValue(key, out var accountId) &&
            _accounts.TryGetValue(accountId, out var account))
        {
            return Task.FromResult<OAuthAccount?>(account);
        }

        return Task.FromResult<OAuthAccount?>(null);
    }

    public Task<List<OAuthAccount>> GetByOrganizerIdAsync(Guid organizerId)
    {
        var accounts = _accounts.Values
            .Where(a => a.OrganizerId == organizerId)
            .ToList();
        return Task.FromResult(accounts);
    }

    public Task<OAuthAccount> AddAsync(OAuthAccount account)
    {
        var key = (account.Provider, account.ProviderUserId);
        _accounts.TryAdd(account.Id, account);
        _providerIndex[key] = account.Id;
        return Task.FromResult(account);
    }

    public Task UpdateAsync(OAuthAccount account)
    {
        var key = (account.Provider, account.ProviderUserId);
        _accounts.AddOrUpdate(account.Id, account, (key, oldValue) => account);
        _providerIndex[key] = account.Id;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Guid id)
    {
        if (_accounts.TryRemove(id, out var account))
        {
            var key = (account.Provider, account.ProviderUserId);
            _providerIndex.TryRemove(key, out _);
        }

        return Task.CompletedTask;
    }
}
