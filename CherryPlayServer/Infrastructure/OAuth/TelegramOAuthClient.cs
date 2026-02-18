using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Web;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Infrastructure.OAuth;

public class TelegramOAuthClient : IOAuthProviderClient
{
    private readonly string _botToken;
    private readonly HttpClient _httpClient;

    public OAuthProvider Provider => OAuthProvider.Telegram;

    public TelegramOAuthClient(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _botToken = configuration["OAUTH_TELEGRAM_BOT_TOKEN"] ?? "test_bot_token";
        _httpClient = httpClientFactory.CreateClient();
    }

    public Task<string> GetAuthorizationUrlAsync(string redirectUri, string? state = null)
    {
        // Telegram Login Widget использует другой подход
        // Для начала используем простой redirect на Telegram Bot API
        // В реальной реализации нужно использовать Telegram Login Widget
        var parameters = new Dictionary<string, string>
        {
            { "redirect_uri", redirectUri }
        };

        if (!string.IsNullOrEmpty(state))
        {
            parameters["state"] = state;
        }

        var queryString = string.Join("&", parameters.Select(p => $"{HttpUtility.UrlEncode(p.Key)}={HttpUtility.UrlEncode(p.Value)}"));
        // В реальной реализации это будет URL для Telegram Login Widget
        var url = $"https://oauth.telegram.org/auth?{queryString}";

        return Task.FromResult(url);
    }

    public async Task<OAuthUserInfo> ExchangeCodeAsync(string code, string redirectUri)
    {
        // Telegram Login Widget возвращает данные через query параметры после авторизации
        // Для упрощения в v1 используем заглушку, которая принимает данные напрямую

        // В реальной реализации нужно проверить подпись данных от Telegram
        // и извлечь информацию о пользователе из query параметров

        // Заглушка для разработки: принимаем code как JSON строку с данными пользователя
        try
        {
            var userData = JsonSerializer.Deserialize<JsonElement>(code);

            var userId = userData.TryGetProperty("id", out var idElement)
                ? idElement.GetInt64().ToString()
                : throw new InvalidOperationException("Failed to get user ID from Telegram");

            var firstName = userData.TryGetProperty("first_name", out var fn) ? fn.GetString() : null;
            var lastName = userData.TryGetProperty("last_name", out var ln) ? ln.GetString() : null;
            var userName = $"{firstName} {lastName}".Trim();
            var avatarUrl = userData.TryGetProperty("photo_url", out var photo) ? photo.GetString() : null;

            return new OAuthUserInfo(
                ProviderUserId: userId,
                ProviderUserName: userName,
                ProviderUserAvatarUrl: avatarUrl
            );
        }
        catch
        {
            // Fallback: используем code как userId для тестирования
            return new OAuthUserInfo(
                ProviderUserId: code,
                ProviderUserName: "Telegram User",
                ProviderUserAvatarUrl: null
            );
        }
    }
}
