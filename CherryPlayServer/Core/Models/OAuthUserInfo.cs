namespace CherryPlayServer.Core.Models;

public record OAuthUserInfo(
    string ProviderUserId,
    string? ProviderUserName,
    string? ProviderUserAvatarUrl
);
