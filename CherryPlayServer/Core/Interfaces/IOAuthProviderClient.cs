using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IOAuthProviderClient
{
    OAuthProvider Provider { get; }
    Task<string> GetAuthorizationUrlAsync(string redirectUri, string? state = null);
    Task<OAuthUserInfo> ExchangeCodeAsync(string code, string redirectUri);
}
