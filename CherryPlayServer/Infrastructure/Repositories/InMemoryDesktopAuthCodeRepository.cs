using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryDesktopAuthCodeRepository : IDesktopAuthCodeRepository
{
    private readonly ConcurrentDictionary<Guid, DesktopAuthCode> _codes = new();

    public Task<DesktopAuthCode> AddAsync(DesktopAuthCode code)
    {
        _codes[code.Id] = Clone(code);
        return Task.FromResult(Clone(code));
    }

    public Task<DesktopAuthCode?> GetValidByTokenHashAsync(string tokenHash)
    {
        var now = DateTime.UtcNow;
        var match = _codes.Values.FirstOrDefault(c =>
            c.TokenHash == tokenHash
            && c.UsedAt == null
            && c.ExpiresAt > now);
        return Task.FromResult(match is null ? null : Clone(match));
    }

    public Task<bool> TryMarkUsedAsync(Guid codeId)
    {
        while (_codes.TryGetValue(codeId, out var current))
        {
            var now = DateTime.UtcNow;
            if (current.UsedAt != null || current.ExpiresAt <= now)
            {
                return Task.FromResult(false);
            }

            var updated = Clone(current);
            updated.UsedAt = now;
            if (_codes.TryUpdate(codeId, updated, current))
            {
                return Task.FromResult(true);
            }
        }

        return Task.FromResult(false);
    }

    private static DesktopAuthCode Clone(DesktopAuthCode code)
    {
        return new DesktopAuthCode
        {
            Id = code.Id,
            OrganizerId = code.OrganizerId,
            TokenHash = code.TokenHash,
            ExpiresAt = code.ExpiresAt,
            UsedAt = code.UsedAt,
            CreatedAt = code.CreatedAt,
        };
    }
}
