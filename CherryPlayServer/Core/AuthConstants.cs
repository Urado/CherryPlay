namespace CherryPlayServer.Core;

public static class AuthConstants
{
    public const int MinPasswordLength = 6;
    public const int MaxOrganizerNameLength = 200;
    public const int TokenLifetimeDays = 30;
    public static readonly TimeSpan JwtClockSkew = TimeSpan.FromMinutes(5);
    public const string InvalidCredentialsMessage = "Invalid email or password";
    public const string DummyPasswordHash = "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtY.RRDPuC8Oi";
    public const string AuthCookieName = "auth_token";
    public const string BearerPrefix = "Bearer ";

    // Rate limiting
    public const int AuthRateLimitPermits = 10;
    public const int PublicApiRateLimitPermits = 60;
    public const int AdminApiRateLimitPermits = 30;
    public const int SignalRRateLimitPermits = 100;
    public static readonly TimeSpan RateLimitWindow = TimeSpan.FromMinutes(1);

    // Party limits
    public const int MaxFuturePartiesPerOrganizer = 2;
    public const int MaxPlaylistTracks = 10000;
}
