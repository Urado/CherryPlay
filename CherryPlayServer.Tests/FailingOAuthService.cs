using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Tests;

public sealed class FailingOAuthService : IOAuthService
{
    public Task<string> GetAuthorizationUrlAsync(OAuthProvider provider, string redirectUri, string? state = null) =>
        throw CreateSensitiveException();

    public Task<OAuthUserInfo> ExchangeCodeAsync(OAuthProvider provider, string code, string redirectUri) =>
        throw CreateSensitiveException();

    public Task<OAuthUserInfo> ExchangeVkIdCodeAsync(string code, string deviceId, string redirectUri) =>
        throw CreateSensitiveException();

    private static InvalidOperationException CreateSensitiveException() =>
        new("private-oauth-token private@example.test PARTYSECRET");
}
