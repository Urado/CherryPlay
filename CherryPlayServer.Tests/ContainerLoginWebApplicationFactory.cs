using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Tests;

public sealed class ContainerLoginWebApplicationFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureLogging(logging => logging.ClearProviders());
        builder.UseEnvironment("Production");
        builder.UseSetting("UseInMemoryStorage", "false");
        builder.UseSetting("Database:AutoMigrateOnStartup", "true");
        builder.UseSetting("ConnectionStrings:DefaultConnection", connectionString);
        builder.UseSetting("JWT_SECRET_KEY", "isolated-login-tests-signing-key-at-least-32chars");
        builder.UseSetting("Auth:OAuthEnabled", "false");
        builder.UseSetting("PartyDisplayStatus:OrganizerOfflineGraceSeconds", "0");
    }
}
