using System.Security.Cryptography;
using System.Text;
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

    public string GenerateAndStoreState(string provider)
    {
        if (string.IsNullOrWhiteSpace(provider))
            throw new ArgumentException("Provider cannot be empty", nameof(provider));

        // Generate cryptographically secure random state token
        var randomBytes = new byte[32];
        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(randomBytes);
        }

        var stateToken = Convert.ToBase64String(randomBytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .Replace("=", "");

        // Store state with provider info
        var cacheKey = $"oauth_state_{stateToken}";
        _cache.Set(cacheKey, provider, _stateLifetime);

        return stateToken;
    }

    public bool ValidateAndConsumeState(string? state, string expectedProvider)
    {
        if (string.IsNullOrWhiteSpace(state) || string.IsNullOrWhiteSpace(expectedProvider))
            return false;

        var cacheKey = $"oauth_state_{state}";

        if (!_cache.TryGetValue(cacheKey, out string? storedProvider))
            return false;

        // Validate provider matches
        if (!string.Equals(storedProvider, expectedProvider, StringComparison.OrdinalIgnoreCase))
            return false;

        // Consume state (remove from cache to prevent reuse)
        _cache.Remove(cacheKey);
        return true;
    }
}
