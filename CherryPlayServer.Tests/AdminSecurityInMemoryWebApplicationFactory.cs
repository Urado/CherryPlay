using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CherryPlayServer.Tests;

public sealed class AdminSecurityInMemoryWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("UseInMemoryStorage", "true");
        builder.UseSetting("JWT_SECRET_KEY", "admin-security-integration-tests-secret-key-32chars");
        builder.UseSetting("Auth:OAuthEnabled", "false");
        builder.UseSetting("Cors:AllowedOrigins:0", "https://web.example");
        builder.UseSetting("PUBLIC_WEB_BASE_URL", "https://web.example");
    }
}
