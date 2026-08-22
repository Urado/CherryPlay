using System.Security.Cryptography;
using CherryPlayServer.Core.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace CherryPlayServer.Core.Services;

public class OAuthStateService : IOAuthStateService
{
    private readonly IMemoryCache _cache;
    private readonly TimeSpan _stateLifetime = TimeSpan.FromMinutes(10);

    public OAuthStateService(IMemoryCache cache)
    {
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
    }

    public string GenerateAndStoreState(string provider, string? client = null, string? returnTo = null)
    {
        if (string.IsNullOrWhiteSpace(provider))
        {
            throw new ArgumentException("Provider cannot be empty", nameof(provider));
        }

        var randomBytes = new byte[32];
        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(randomBytes);
        }

        var stateToken = Convert.ToBase64String(randomBytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .Replace("=", "");

        var cacheKey = BuildCacheKey(stateToken);
        _cache.Set(cacheKey, new OAuthStateEntry(provider, client, returnTo), _stateLifetime);

        return stateToken;
    }

    public bool ValidateAndConsumeState(string? state, string expectedProvider)
    {
        return ValidateAndConsumeStateWithClient(state, expectedProvider) != null;
    }

    public OAuthStateConsumeResult? ValidateAndConsumeStateWithClient(string? state, string expectedProvider)
    {
        if (string.IsNullOrWhiteSpace(state) || string.IsNullOrWhiteSpace(expectedProvider))
        {
            return null;
        }

        var cacheKey = BuildCacheKey(state);
        if (!_cache.TryGetValue(cacheKey, out OAuthStateEntry? entry) || entry == null)
        {
            return null;
        }

        if (!string.Equals(entry.Provider, expectedProvider, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        _cache.Remove(cacheKey);
        return new OAuthStateConsumeResult(entry.Client, entry.ReturnTo);
    }

    private static string BuildCacheKey(string stateToken) => $"oauth_state_{stateToken}";

    private sealed record OAuthStateEntry(string Provider, string? Client, string? ReturnTo);
}
