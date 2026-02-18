using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IOAuthService
{
    Task<string> GetAuthorizationUrlAsync(OAuthProvider provider, string redirectUri, string? state = null);
    Task<OAuthUserInfo> ExchangeCodeAsync(OAuthProvider provider, string code, string redirectUri);
    Task<OAuthUserInfo> ExchangeVkIdCodeAsync(string code, string deviceId, string redirectUri);
}
