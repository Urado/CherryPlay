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
}
