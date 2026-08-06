using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryPasswordResetTokenRepository : IPasswordResetTokenRepository
{
    private readonly ConcurrentDictionary<Guid, PasswordResetToken> _tokens = new();

    public Task<PasswordResetToken> AddAsync(PasswordResetToken token)
    {
        _tokens[token.Id] = Clone(token);
        return Task.FromResult(Clone(token));
    }

    public Task<PasswordResetToken?> GetValidByTokenHashAsync(string tokenHash)
    {
        var now = DateTime.UtcNow;
        var match = _tokens.Values.FirstOrDefault(t =>
            t.TokenHash == tokenHash
            && t.UsedAt == null
            && t.ExpiresAt > now);
        return Task.FromResult(match is null ? null : Clone(match));
    }

    public Task InvalidateUnusedByEmailAccountIdAsync(Guid emailAccountId)
    {
        var now = DateTime.UtcNow;
        foreach (var token in _tokens.Values.Where(t => t.EmailAccountId == emailAccountId && t.UsedAt == null))
        {
            token.UsedAt = now;
        }

        return Task.CompletedTask;
    }

    public Task<bool> TryMarkUsedAsync(Guid tokenId)
    {
        if (!_tokens.TryGetValue(tokenId, out var token))
        {
            return Task.FromResult(false);
        }

        var now = DateTime.UtcNow;
        if (token.UsedAt != null || token.ExpiresAt <= now)
        {
            return Task.FromResult(false);
        }

        token.UsedAt = now;
        return Task.FromResult(true);
    }

    public Task<bool> TryUnmarkUsedAsync(Guid tokenId)
    {
        if (!_tokens.TryGetValue(tokenId, out var token) || token.UsedAt == null)
        {
            return Task.FromResult(false);
        }

        token.UsedAt = null;
        return Task.FromResult(true);
    }

    private static PasswordResetToken Clone(PasswordResetToken token)
    {
        return new PasswordResetToken
        {
            Id = token.Id,
            EmailAccountId = token.EmailAccountId,
            TokenHash = token.TokenHash,
            ExpiresAt = token.ExpiresAt,
            UsedAt = token.UsedAt,
            CreatedAt = token.CreatedAt,
        };
    }
}
