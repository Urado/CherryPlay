using System.Net.Http;
using System.Text.Json;
using System.Web;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Infrastructure.OAuth;

public class VkOAuthClient : IOAuthProviderClient
{
    private readonly string _clientId;
    private readonly string _clientSecret;
    private readonly HttpClient _httpClient;

    public OAuthProvider Provider => OAuthProvider.Vk;

    public VkOAuthClient(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _clientId = configuration["OAUTH_VK_CLIENT_ID"] ?? "test_client_id";
        _clientSecret = configuration["OAUTH_VK_CLIENT_SECRET"] ?? "test_client_secret";
        _httpClient = httpClientFactory.CreateClient();
    }

    public Task<string> GetAuthorizationUrlAsync(string redirectUri, string? state = null)
    {
        var parameters = new Dictionary<string, string>
        {
            { "client_id", _clientId },
            { "redirect_uri", redirectUri },
            { "response_type", "code" },
            { "scope", "email" },
            { "v", "5.131" }
        };

        if (!string.IsNullOrEmpty(state))
        {
            parameters["state"] = state;
        }

        var queryString = string.Join("&", parameters.Select(p => $"{HttpUtility.UrlEncode(p.Key)}={HttpUtility.UrlEncode(p.Value)}"));
        var url = $"https://oauth.vk.com/authorize?{queryString}";

        return Task.FromResult(url);
    }

    public async Task<OAuthUserInfo> ExchangeCodeAsync(string code, string redirectUri)
    {
        // Обмен code на access_token
        var tokenUrl = $"https://oauth.vk.com/access_token" +
                       $"?client_id={HttpUtility.UrlEncode(_clientId)}" +
                       $"&client_secret={HttpUtility.UrlEncode(_clientSecret)}" +
                       $"&redirect_uri={HttpUtility.UrlEncode(redirectUri)}" +
                       $"&code={HttpUtility.UrlEncode(code)}";

        var tokenResponse = await _httpClient.GetStringAsync(tokenUrl);
        var tokenData = JsonSerializer.Deserialize<JsonElement>(tokenResponse);

        if (!tokenData.TryGetProperty("access_token", out var accessTokenElement))
        {
            throw new InvalidOperationException("Failed to get access token from VK");
        }

        var accessToken = accessTokenElement.GetString() ?? throw new InvalidOperationException("Access token is null");

        // Получение информации о пользователе
        var userId = tokenData.TryGetProperty("user_id", out var userIdElement)
            ? userIdElement.GetInt32().ToString()
            : throw new InvalidOperationException("Failed to get user_id from VK");

        var userInfoUrl = $"https://api.vk.com/method/users.get" +
                         $"?user_ids={userId}" +
                         $"&access_token={accessToken}" +
                         $"&fields=photo_200" +
                         $"&v=5.131";

        var userResponse = await _httpClient.GetStringAsync(userInfoUrl);
        var userData = JsonSerializer.Deserialize<JsonElement>(userResponse);

        if (userData.TryGetProperty("response", out var responseElement) &&
            responseElement.ValueKind == JsonValueKind.Array &&
            responseElement.GetArrayLength() > 0)
        {
            var user = responseElement[0];
            var firstName = user.TryGetProperty("first_name", out var fn) ? fn.GetString() : null;
            var lastName = user.TryGetProperty("last_name", out var ln) ? ln.GetString() : null;
            var userName = $"{firstName} {lastName}".Trim();
            var avatarUrl = user.TryGetProperty("photo_200", out var photo) ? photo.GetString() : null;

            return new OAuthUserInfo(
                ProviderUserId: userId,
                ProviderUserName: userName,
                ProviderUserAvatarUrl: avatarUrl
            );
        }

        // Fallback: возвращаем только userId
        return new OAuthUserInfo(
            ProviderUserId: userId,
            ProviderUserName: null,
            ProviderUserAvatarUrl: null
        );
    }

    /// <summary>
    /// Обмен кода VK ID на access_token (с поддержкой device_id)
    /// </summary>
    public async Task<OAuthUserInfo> ExchangeVkIdCodeAsync(string code, string deviceId, string redirectUri)
    {
        // Проверяем, что client_id установлен
        if (string.IsNullOrEmpty(_clientId) || _clientId == "test_client_id")
        {
            throw new InvalidOperationException("VK Client ID is not configured. Please set OAUTH_VK_CLIENT_ID environment variable.");
        }

        // VK ID использует POST запрос для обмена кода
        var tokenRequest = new Dictionary<string, string>
        {
            { "client_id", _clientId },
            { "client_secret", _clientSecret },
            { "redirect_uri", redirectUri },
            { "code", code },
            { "grant_type", "authorization_code" }
        };

        if (!string.IsNullOrEmpty(deviceId))
        {
            tokenRequest["device_id"] = deviceId;
        }

        var tokenContent = new FormUrlEncodedContent(tokenRequest);
        var tokenResponse = await _httpClient.PostAsync("https://oauth.vk.com/access_token", tokenContent);
        var tokenResponseText = await tokenResponse.Content.ReadAsStringAsync();

        if (!tokenResponse.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Failed to exchange VK ID code: {tokenResponseText}");
        }

        var tokenData = JsonSerializer.Deserialize<JsonElement>(tokenResponseText);

        // Проверяем наличие ошибки в ответе
        if (tokenData.TryGetProperty("error", out var errorElement))
        {
            var errorDescription = tokenData.TryGetProperty("error_description", out var descElement)
                ? descElement.GetString()
                : "Unknown error";
            throw new InvalidOperationException($"VK ID error: {errorElement.GetString()} - {errorDescription}");
        }

        if (!tokenData.TryGetProperty("access_token", out var accessTokenElement))
        {
            throw new InvalidOperationException($"Failed to get access token from VK ID. Response: {tokenResponseText}");
        }

        var accessToken = accessTokenElement.GetString() ?? throw new InvalidOperationException("Access token is null");

        // Получение информации о пользователе
        var userId = tokenData.TryGetProperty("user_id", out var userIdElement)
            ? userIdElement.GetInt32().ToString()
            : throw new InvalidOperationException("Failed to get user_id from VK ID");

        var userInfoUrl = $"https://api.vk.com/method/users.get" +
                         $"?user_ids={userId}" +
                         $"&access_token={accessToken}" +
                         $"&fields=photo_200" +
                         $"&v=5.131";

        var userResponse = await _httpClient.GetStringAsync(userInfoUrl);
        var userData = JsonSerializer.Deserialize<JsonElement>(userResponse);

        if (userData.TryGetProperty("response", out var responseElement) &&
            responseElement.ValueKind == JsonValueKind.Array &&
            responseElement.GetArrayLength() > 0)
        {
            var user = responseElement[0];
            var firstName = user.TryGetProperty("first_name", out var fn) ? fn.GetString() : null;
            var lastName = user.TryGetProperty("last_name", out var ln) ? ln.GetString() : null;
            var userName = $"{firstName} {lastName}".Trim();
            var avatarUrl = user.TryGetProperty("photo_200", out var photo) ? photo.GetString() : null;

            return new OAuthUserInfo(
                ProviderUserId: userId,
                ProviderUserName: userName,
                ProviderUserAvatarUrl: avatarUrl
            );
        }

        // Fallback: возвращаем только userId
        return new OAuthUserInfo(
            ProviderUserId: userId,
            ProviderUserName: null,
            ProviderUserAvatarUrl: null
        );
    }
}
