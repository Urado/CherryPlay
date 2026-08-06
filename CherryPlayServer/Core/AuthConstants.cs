namespace CherryPlayServer.Core;

public static class AuthConstants
{
    public const int MinPasswordLength = 6;
    public const int MaxOrganizerNameLength = 200;
    public const int TokenLifetimeDays = 30;
    public static readonly TimeSpan JwtClockSkew = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan PasswordResetTokenTtl = TimeSpan.FromHours(1);
    public const string InvalidCredentialsMessage = "Invalid email or password";
    public const string DummyPasswordHash = "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtY.RRDPuC8Oi";
    public const string AuthCookieName = "auth_token";
    public const string BearerPrefix = "Bearer ";
    public const string ForgotPasswordGenericMessage =
        "Если аккаунт с таким email существует, мы отправили инструкции";
    public const string PasswordResetInvalidTokenMessage =
        "Ссылка для сброса пароля недействительна или устарела";
    public static string PasswordTooShortMessage =>
        $"Пароль должен содержать не менее {MinPasswordLength} символов";
    public const string ChangePasswordOAuthOnlyMessage =
        "Смена пароля доступна только для аккаунта с email и паролем";
    public const string WrongCurrentPasswordMessage = "Неверный текущий пароль";
    public const string EmailServiceUnavailableMessage =
        "Сервис временно недоступен. Попробуйте позже.";
    public const string PasswordResetEmailSubject = "Сброс пароля CherryPlay";
    public const int AuthRateLimitPermits = 10;
    public const int PublicApiRateLimitPermits = 60;
    public const int AdminApiRateLimitPermits = 30;
    public const int SignalRRateLimitPermits = 100;
    public static readonly TimeSpan RateLimitWindow = TimeSpan.FromMinutes(1);
    public const int MaxFuturePartiesPerOrganizer = 2;
    public const int MaxPlaylistTracks = 10000;
}
