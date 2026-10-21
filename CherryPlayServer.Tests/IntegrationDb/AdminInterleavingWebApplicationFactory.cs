using CherryPlayServer.Core.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CherryPlayServer.Tests.IntegrationDb;

public sealed class AdminInterleavingWebApplicationFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("UseInMemoryStorage", "false");
        builder.UseSetting("Database:AutoMigrateOnStartup", "true");
        builder.UseSetting("ConnectionStrings:DefaultConnection", connectionString);
        builder.UseSetting("JWT_SECRET_KEY", "integration-tests-secret-key-minimum-32-characters");
        builder.UseSetting("Auth:OAuthEnabled", "false");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IPartyRepository>();
            services.AddScoped<IPartyRepository, AdminInterleavingPartyRepository>();
            services.RemoveAll<IDesktopUpdateVersionService>();
            services.AddSingleton<IDesktopUpdateVersionService, DesktopUpdateVersionServiceStub>();
        });
    }
}
