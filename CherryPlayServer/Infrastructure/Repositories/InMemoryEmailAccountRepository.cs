using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryEmailAccountRepository : IEmailAccountRepository
{
    private readonly ConcurrentDictionary<Guid, EmailAccount> _accounts = new();
    private readonly ConcurrentDictionary<string, Guid> _emailToId = new(StringComparer.OrdinalIgnoreCase);

    public Task<EmailAccount?> GetByIdAsync(Guid id)
    {
        _accounts.TryGetValue(id, out var account);
        return Task.FromResult(account);
    }

    public Task<EmailAccount?> GetByEmailAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return Task.FromResult<EmailAccount?>(null);
        }

        if (_emailToId.TryGetValue(email, out var id) && _accounts.TryGetValue(id, out var account))
        {
            return Task.FromResult<EmailAccount?>(account);
        }

        return Task.FromResult<EmailAccount?>(null);
    }

    public Task<EmailAccount?> GetByOrganizerIdAsync(Guid organizerId)
    {
        var account = _accounts.Values.FirstOrDefault(a => a.OrganizerId == organizerId);
        return Task.FromResult<EmailAccount?>(account);
    }

    public Task<EmailAccount> AddAsync(EmailAccount account)
    {
        if (string.IsNullOrWhiteSpace(account.Email))
        {
            throw new ArgumentException("Email cannot be empty", nameof(account));
        }

        if (_emailToId.ContainsKey(account.Email))
        {
            throw new InvalidOperationException($"Email {account.Email} is already registered");
        }

        _accounts.TryAdd(account.Id, account);
        _emailToId.TryAdd(account.Email, account.Id);

        return Task.FromResult(account);
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
                if (_emailToId.ContainsKey(account.Email))
                {
                    throw new InvalidOperationException($"Email {account.Email} is already registered");
                }

                _emailToId.TryAdd(account.Email, account.Id);
            }
        }

        account.LastUsedAt ??= DateTime.UtcNow;
        _accounts.AddOrUpdate(account.Id, account, (key, oldValue) => account);

        return Task.CompletedTask;
    }
}
