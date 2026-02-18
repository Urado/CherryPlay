using System.Text.Json;
using System.Web;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Infrastructure.OAuth;

public class MailRuOAuthClient : IOAuthProviderClient
{
    private readonly string _clientId;
    private readonly string _clientSecret;
    private readonly HttpClient _httpClient;

    public OAuthProvider Provider => OAuthProvider.MailRu;

    public MailRuOAuthClient(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _clientId = configuration["OAUTH_MAILRU_CLIENT_ID"] ?? "test_client_id";
        _clientSecret = configuration["OAUTH_MAILRU_CLIENT_SECRET"] ?? "test_client_secret";
        _httpClient = httpClientFactory.CreateClient();
    }

    public Task<string> GetAuthorizationUrlAsync(string redirectUri, string? state = null)
    {
        var parameters = new Dictionary<string, string>
        {
            { "client_id", _clientId },
            { "redirect_uri", redirectUri },
            { "response_type", "code" }
        };

        if (!string.IsNullOrEmpty(state))
        {
            parameters["state"] = state;
        }

        var queryString = string.Join("&", parameters.Select(p => $"{HttpUtility.UrlEncode(p.Key)}={HttpUtility.UrlEncode(p.Value)}"));
        var url = $"https://oauth.mail.ru/login?{queryString}";

        return Task.FromResult(url);
    }

    public async Task<OAuthUserInfo> ExchangeCodeAsync(string code, string redirectUri)
    {
        // Обмен code на access_token
        var tokenRequest = new Dictionary<string, string>
        {
            { "client_id", _clientId },
            { "client_secret", _clientSecret },
            { "grant_type", "authorization_code" },
            { "code", code },
            { "redirect_uri", redirectUri }
        };

        var tokenContent = new FormUrlEncodedContent(tokenRequest);
        var tokenResponse = await _httpClient.PostAsync("https://oauth.mail.ru/token", tokenContent);
        var tokenResponseText = await tokenResponse.Content.ReadAsStringAsync();

        if (!tokenResponse.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Failed to exchange code: {tokenResponseText}");
        }

        var tokenData = JsonSerializer.Deserialize<JsonElement>(tokenResponseText);

        if (!tokenData.TryGetProperty("access_token", out var accessTokenElement))
        {
            throw new InvalidOperationException("Failed to get access token from Mail.ru");
        }

        var accessToken = accessTokenElement.GetString() ?? throw new InvalidOperationException("Access token is null");

        // Получение информации о пользователе
        var userInfoUrl = $"https://oauth.mail.ru/userinfo?access_token={HttpUtility.UrlEncode(accessToken)}";
        var userResponse = await _httpClient.GetStringAsync(userInfoUrl);
        var userData = JsonSerializer.Deserialize<JsonElement>(userResponse);

        string? userId = null;
        if (userData.TryGetProperty("email", out var emailElement))
        {
            userId = emailElement.GetString();
        }
        if (userId == null && userData.TryGetProperty("id", out var idElement))
        {
            userId = idElement.GetString();
        }

        if (userId == null)
        {
            throw new InvalidOperationException("Failed to get user ID from Mail.ru");
        }

        var userName = userData.TryGetProperty("name", out var nameElement)
            ? nameElement.GetString()
            : userData.TryGetProperty("email", out var emailEl)
                ? emailEl.GetString()
                : null;

        var avatarUrl = userData.TryGetProperty("image", out var imageElement)
            ? imageElement.GetString()
            : null;

        return new OAuthUserInfo(
            ProviderUserId: userId,
            ProviderUserName: userName,
            ProviderUserAvatarUrl: avatarUrl
        );
    }
}
