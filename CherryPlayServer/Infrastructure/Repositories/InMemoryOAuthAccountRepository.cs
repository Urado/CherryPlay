using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryOAuthAccountRepository : IOAuthAccountRepository
{
    private readonly ConcurrentDictionary<Guid, OAuthAccount> _accounts = new();
    private readonly ConcurrentDictionary<(OAuthProvider Provider, string ProviderUserId), Guid> _providerIndex =
        new();
    private readonly ConcurrentDictionary<(OAuthProvider Provider, string ProviderUserId), SemaphoreSlim> _providerLocks =
        new();

    public Task<OAuthAccount?> GetByProviderUserIdAsync(OAuthProvider provider, string providerUserId)
    {
        var key = (provider, providerUserId);
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            if (_providerIndex.TryGetValue(key, out var accountId) &&
                _accounts.TryGetValue(accountId, out var account))
            {
                return Task.FromResult<OAuthAccount?>(account);
            }

            return Task.FromResult<OAuthAccount?>(null);
        }

        return Task.FromResult(GetVisibleByProvider(tx, key));
    }

    public async Task<OAuthAccount?> GetByProviderUserIdForUpdateAsync(
        OAuthProvider provider,
        string providerUserId,
        CancellationToken cancellationToken = default)
    {
        var key = (provider, providerUserId);
        var tx = InMemoryUnitOfWorkScope.Current
            ?? throw new InvalidOperationException(
                "GetByProviderUserIdForUpdateAsync requires an active transaction.");

        if (tx.HeldOAuthLocks.Add(key))
        {
            var gate = _providerLocks.GetOrAdd(key, static _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync(cancellationToken);
            tx.OnExit(() => gate.Release());
        }

        return GetVisibleByProvider(tx, key);
    }

    public Task<List<OAuthAccount>> GetByOrganizerIdAsync(Guid organizerId)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        IEnumerable<OAuthAccount> source = tx is null
            ? _accounts.Values
            : VisibleAccounts(tx);

        var accounts = source
            .Where(a => a.OrganizerId == organizerId)
            .ToList();
        return Task.FromResult(accounts);
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

    public Task<bool> TryAddAsync(OAuthAccount account)
    {
        var key = (account.Provider, account.ProviderUserId);
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            return TryAddImmediateAsync(account, key);
        }

        if (GetVisibleById(tx, account.Id) is not null || GetVisibleByProvider(tx, key) is not null)
        {
            return Task.FromResult(false);
        }

        tx.RegisterParticipant(this, undos => Apply(tx, undos));
        tx.OAuthRemoves.Remove(account.Id);
        tx.OAuthIndexRemoves.Remove(key);
        tx.OAuthAdds[account.Id] = account;
        tx.OAuthIndexAdds[key] = account.Id;
        return Task.FromResult(true);
    }

    public Task UpdateAsync(OAuthAccount account)
    {
        var newKey = (account.Provider, account.ProviderUserId);
        if (_accounts.TryGetValue(account.Id, out var existing))
        {
            var oldKey = (existing.Provider, existing.ProviderUserId);
            if (!oldKey.Equals(newKey))
            {
                _providerIndex.TryRemove(oldKey, out _);
            }
        }

        _accounts.AddOrUpdate(account.Id, account, (_, _) => account);
        _providerIndex[newKey] = account.Id;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(Guid id)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            if (_accounts.TryRemove(id, out var account))
            {
                var key = (account.Provider, account.ProviderUserId);
                _providerIndex.TryRemove(key, out _);
            }

            return Task.CompletedTask;
        }

        if (tx.OAuthAdds.Remove(id, out var pending))
        {
            tx.OAuthIndexAdds.Remove((pending.Provider, pending.ProviderUserId));
            return Task.CompletedTask;
        }

        if (!_accounts.TryGetValue(id, out var stored) || tx.OAuthRemoves.Contains(id))
        {
            return Task.CompletedTask;
        }

        tx.RegisterParticipant(this, undos => Apply(tx, undos));
        tx.OAuthRemoves.Add(id);
        tx.OAuthIndexRemoves.Add((stored.Provider, stored.ProviderUserId));
        return Task.CompletedTask;
    }

    private Task<bool> TryAddImmediateAsync(
        OAuthAccount account,
        (OAuthProvider Provider, string ProviderUserId) key)
    {
        if (!_providerIndex.TryAdd(key, account.Id))
        {
            return Task.FromResult(false);
        }

        if (!_accounts.TryAdd(account.Id, account))
        {
            _providerIndex.TryRemove(key, out _);
            return Task.FromResult(false);
        }

        return Task.FromResult(true);
    }

    private OAuthAccount? GetVisibleById(InMemoryLegalConsentTransaction tx, Guid id)
    {
        if (tx.OAuthRemoves.Contains(id))
        {
            return null;
        }

        if (tx.OAuthAdds.TryGetValue(id, out var pending))
        {
            return pending;
        }

        _accounts.TryGetValue(id, out var account);
        return account;
    }

    private OAuthAccount? GetVisibleByProvider(
        InMemoryLegalConsentTransaction tx,
        (OAuthProvider Provider, string ProviderUserId) key)
    {
        if (tx.OAuthIndexAdds.TryGetValue(key, out var pendingId) &&
            tx.OAuthAdds.TryGetValue(pendingId, out var pending))
        {
            return pending;
        }

        if (tx.OAuthIndexRemoves.Contains(key))
        {
            return null;
        }

        if (_providerIndex.TryGetValue(key, out var accountId) &&
            !tx.OAuthRemoves.Contains(accountId) &&
            _accounts.TryGetValue(accountId, out var account))
        {
            return account;
        }

        return null;
    }

    private IEnumerable<OAuthAccount> VisibleAccounts(InMemoryLegalConsentTransaction tx)
    {
        foreach (var account in _accounts.Values)
        {
            if (!tx.OAuthRemoves.Contains(account.Id) && !tx.OAuthAdds.ContainsKey(account.Id))
            {
                yield return account;
            }
        }

        foreach (var account in tx.OAuthAdds.Values)
        {
            if (!tx.OAuthRemoves.Contains(account.Id))
            {
                yield return account;
            }
        }
    }

    private void Apply(InMemoryLegalConsentTransaction tx, ICollection<Action> undos)
    {
        foreach (var id in tx.OAuthRemoves)
        {
            if (_accounts.TryRemove(id, out var removed))
            {
                var key = (removed.Provider, removed.ProviderUserId);
                _providerIndex.TryRemove(key, out _);
                undos.Add(() =>
                {
                    _accounts.TryAdd(id, removed);
                    _providerIndex.TryAdd(key, removed.Id);
                });
            }
        }

        foreach (var (id, account) in tx.OAuthAdds)
        {
            var key = (account.Provider, account.ProviderUserId);
            if (!_providerIndex.TryAdd(key, account.Id))
            {
                throw new InvalidOperationException(
                    $"OAuth account for provider {account.Provider} and user {account.ProviderUserId} already exists");
            }

            undos.Add(() => _providerIndex.TryRemove(key, out _));

            if (!_accounts.TryAdd(id, account))
            {
                throw new InvalidOperationException($"OAuth account with id {id} already exists");
            }

            undos.Add(() => _accounts.TryRemove(id, out _));
        }
    }
}
