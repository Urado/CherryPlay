using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Infrastructure.Persistence;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryEmailAccountRepository : IEmailAccountRepository
{
    private readonly ConcurrentDictionary<Guid, EmailAccount> _accounts = new();
    private readonly ConcurrentDictionary<string, Guid> _emailToId = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _emailLocks = new(StringComparer.OrdinalIgnoreCase);

    public Task<EmailAccount?> GetByIdAsync(Guid id)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            _accounts.TryGetValue(id, out var account);
            return Task.FromResult(account);
        }

        return Task.FromResult(GetVisibleById(tx, id));
    }

    public Task<EmailAccount?> GetByEmailAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return Task.FromResult<EmailAccount?>(null);
        }

        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            if (_emailToId.TryGetValue(email, out var id) && _accounts.TryGetValue(id, out var account))
            {
                return Task.FromResult<EmailAccount?>(account);
            }

            return Task.FromResult<EmailAccount?>(null);
        }

        return Task.FromResult(GetVisibleByEmail(tx, email));
    }

    public async Task<EmailAccount?> GetByEmailForUpdateAsync(
        string email,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var tx = InMemoryUnitOfWorkScope.Current
            ?? throw new InvalidOperationException("GetByEmailForUpdateAsync requires an active transaction.");

        if (tx.HeldEmailLocks.Add(email))
        {
            var gate = _emailLocks.GetOrAdd(email, static _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync(cancellationToken);
            tx.OnExit(() => gate.Release());
        }

        return GetVisibleByEmail(tx, email);
    }

    public Task<EmailAccount?> GetByOrganizerIdAsync(Guid organizerId)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            var account = _accounts.Values.FirstOrDefault(a => a.OrganizerId == organizerId);
            return Task.FromResult<EmailAccount?>(account);
        }

        var visible = VisibleAccounts(tx).FirstOrDefault(a => a.OrganizerId == organizerId);
        return Task.FromResult<EmailAccount?>(visible);
    }

    public async Task<EmailAccount> AddAsync(EmailAccount account)
    {
        if (!await TryAddAsync(account))
        {
            throw new InvalidOperationException($"Email {account.Email} is already registered");
        }

        return account;
    }

    public Task<bool> TryAddAsync(EmailAccount account)
    {
        if (string.IsNullOrWhiteSpace(account.Email))
        {
            throw new ArgumentException("Email cannot be empty", nameof(account));
        }

        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            return TryAddImmediateAsync(account);
        }

        if (GetVisibleById(tx, account.Id) is not null || GetVisibleByEmail(tx, account.Email) is not null)
        {
            return Task.FromResult(false);
        }

        tx.RegisterParticipant(this, undos => Apply(tx, undos));
        tx.EmailRemoves.Remove(account.Id);
        tx.EmailIndexRemoves.Remove(account.Email);
        tx.EmailAdds[account.Id] = account;
        tx.EmailIndexAdds[account.Email] = account.Id;
        return Task.FromResult(true);
    }

    public Task UpdateAsync(EmailAccount account)
    {
        if (!_accounts.ContainsKey(account.Id))
        {
            throw new InvalidOperationException($"EmailAccount with id {account.Id} not found");
        }

        var oldAccount = _accounts[account.Id];

        if (!string.Equals(oldAccount.Email, account.Email, StringComparison.OrdinalIgnoreCase))
        {
            if (!string.IsNullOrWhiteSpace(oldAccount.Email))
            {
                _emailToId.TryRemove(oldAccount.Email, out _);
            }

            if (!string.IsNullOrWhiteSpace(account.Email))
            {
                if (!_emailToId.TryAdd(account.Email, account.Id))
                {
                    if (!string.IsNullOrWhiteSpace(oldAccount.Email))
                    {
                        _emailToId.TryAdd(oldAccount.Email, account.Id);
                    }

                    throw new InvalidOperationException($"Email {account.Email} is already registered");
                }
            }
        }

        account.LastUsedAt ??= DateTime.UtcNow;
        _accounts.AddOrUpdate(account.Id, account, (key, oldValue) => account);

        return Task.CompletedTask;
    }

    public Task DeleteAsync(Guid id)
    {
        var tx = InMemoryUnitOfWorkScope.Current;
        if (tx is null)
        {
            if (_accounts.TryRemove(id, out var account) && !string.IsNullOrWhiteSpace(account.Email))
            {
                _emailToId.TryRemove(account.Email, out _);
            }

            return Task.CompletedTask;
        }

        if (tx.EmailAdds.Remove(id, out var pending))
        {
            tx.EmailIndexAdds.Remove(pending.Email);
            return Task.CompletedTask;
        }

        if (!_accounts.TryGetValue(id, out var stored) || tx.EmailRemoves.Contains(id))
        {
            return Task.CompletedTask;
        }

        tx.RegisterParticipant(this, undos => Apply(tx, undos));
        tx.EmailRemoves.Add(id);
        if (!string.IsNullOrWhiteSpace(stored.Email))
        {
            tx.EmailIndexRemoves.Add(stored.Email);
        }

        return Task.CompletedTask;
    }

    private Task<bool> TryAddImmediateAsync(EmailAccount account)
    {
        if (!_emailToId.TryAdd(account.Email, account.Id))
        {
            return Task.FromResult(false);
        }

        if (!_accounts.TryAdd(account.Id, account))
        {
            _emailToId.TryRemove(account.Email, out _);
            return Task.FromResult(false);
        }

        return Task.FromResult(true);
    }

    private EmailAccount? GetVisibleById(InMemoryLegalConsentTransaction tx, Guid id)
    {
        if (tx.EmailRemoves.Contains(id))
        {
            return null;
        }

        if (tx.EmailAdds.TryGetValue(id, out var pending))
        {
            return pending;
        }

        _accounts.TryGetValue(id, out var account);
        return account;
    }

    private EmailAccount? GetVisibleByEmail(InMemoryLegalConsentTransaction tx, string email)
    {
        if (tx.EmailIndexAdds.TryGetValue(email, out var pendingId) &&
            tx.EmailAdds.TryGetValue(pendingId, out var pending))
        {
            return pending;
        }

        if (tx.EmailIndexRemoves.Contains(email))
        {
            return null;
        }

        if (_emailToId.TryGetValue(email, out var id) &&
            !tx.EmailRemoves.Contains(id) &&
            _accounts.TryGetValue(id, out var account))
        {
            return account;
        }

        return null;
    }

    private IEnumerable<EmailAccount> VisibleAccounts(InMemoryLegalConsentTransaction tx)
    {
        foreach (var account in _accounts.Values)
        {
            if (!tx.EmailRemoves.Contains(account.Id) && !tx.EmailAdds.ContainsKey(account.Id))
            {
                yield return account;
            }
        }

        foreach (var account in tx.EmailAdds.Values)
        {
            if (!tx.EmailRemoves.Contains(account.Id))
            {
                yield return account;
            }
        }
    }

    private void Apply(InMemoryLegalConsentTransaction tx, ICollection<Action> undos)
    {
        foreach (var id in tx.EmailRemoves)
        {
            if (_accounts.TryRemove(id, out var removed))
            {
                Guid? indexId = null;
                if (!string.IsNullOrWhiteSpace(removed.Email) &&
                    _emailToId.TryRemove(removed.Email, out var removedIndexId))
                {
                    indexId = removedIndexId;
                }

                var email = removed.Email;
                undos.Add(() =>
                {
                    _accounts.TryAdd(id, removed);
                    if (indexId.HasValue && !string.IsNullOrWhiteSpace(email))
                    {
                        _emailToId.TryAdd(email, indexId.Value);
                    }
                });
            }
        }

        foreach (var (id, account) in tx.EmailAdds)
        {
            if (!_emailToId.TryAdd(account.Email, account.Id))
            {
                throw new InvalidOperationException($"Email {account.Email} is already registered");
            }

            undos.Add(() => _emailToId.TryRemove(account.Email, out _));

            if (!_accounts.TryAdd(id, account))
            {
                throw new InvalidOperationException($"EmailAccount with id {id} already exists");
            }

            undos.Add(() => _accounts.TryRemove(id, out _));
        }
    }
}
