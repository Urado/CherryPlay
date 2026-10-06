using CherryPlayServer.Core.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Tests;

public sealed class RequestFailureMetricsWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureLogging(logging => logging.ClearProviders());
        builder.UseEnvironment("Development");
        builder.UseSetting("UseInMemoryStorage", "true");
        builder.UseSetting("JWT_SECRET_KEY", SessionParityWebApplicationFactory.JwtSecret);
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IPublicPartyQueryService>();
            services.AddSingleton<IPublicPartyQueryService, ThrowingPublicPartyQueryService>();
        });
    }
}
