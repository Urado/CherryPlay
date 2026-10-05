using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Tests;

public sealed class SessionParityWebApplicationFactory : WebApplicationFactory<Program>
{
    public const string JwtSecret = "signalr-session-parity-test-secret-key-32chars";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureLogging(logging => logging.ClearProviders());
        builder.UseEnvironment("Development");
        builder.UseSetting("UseInMemoryStorage", "true");
        builder.UseSetting("JWT_SECRET_KEY", JwtSecret);
        builder.UseSetting("Auth:OAuthEnabled", "false");
    }
}
