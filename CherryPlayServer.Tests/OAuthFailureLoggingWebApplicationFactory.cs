using CherryPlayServer.Core.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Tests;

public sealed class OAuthFailureLoggingWebApplicationFactory : WebApplicationFactory<Program>
{
    public CapturingOAuthLogProvider LogProvider { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("UseInMemoryStorage", "true");
        builder.UseSetting("JWT_SECRET_KEY", SessionParityWebApplicationFactory.JwtSecret);
        builder.ConfigureLogging(logging =>
        {
            logging.ClearProviders();
            logging.AddProvider(LogProvider);
        });
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IOAuthService>();
            services.AddSingleton<IOAuthService, FailingOAuthService>();
        });
    }
}
