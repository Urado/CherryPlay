using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Infrastructure.OAuth;

namespace CherryPlayServer.Core.Services;

public class OAuthService : IOAuthService
{
    private readonly Dictionary<OAuthProvider, IOAuthProviderClient> _clients;

    public OAuthService(IEnumerable<IOAuthProviderClient> clients)
    {
        _clients = clients.ToDictionary(c => c.Provider, c => c);
    }

    public Task<string> GetAuthorizationUrlAsync(OAuthProvider provider, string redirectUri, string? state = null)
    {
        if (!_clients.TryGetValue(provider, out var client))
        {
            throw new ArgumentException($"OAuth provider {provider} is not supported", nameof(provider));
        }

        return client.GetAuthorizationUrlAsync(redirectUri, state);
    }

    public Task<OAuthUserInfo> ExchangeCodeAsync(OAuthProvider provider, string code, string redirectUri)
    {
        if (!_clients.TryGetValue(provider, out var client))
        {
            throw new ArgumentException($"OAuth provider {provider} is not supported", nameof(provider));
        }

        return client.ExchangeCodeAsync(code, redirectUri);
    }

    public async Task<OAuthUserInfo> ExchangeVkIdCodeAsync(string code, string deviceId, string redirectUri)
    {
        if (!_clients.TryGetValue(OAuthProvider.Vk, out var client) || client is not Infrastructure.OAuth.VkOAuthClient vkClient)
        {
            throw new ArgumentException("VK OAuth client is not available", nameof(code));
        }

        return await vkClient.ExchangeVkIdCodeAsync(code, deviceId, redirectUri);
    }
}
