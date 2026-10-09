using CherryPlayServer.Core.Options;
using CherryPlayServer.Core.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace CherryPlayServer.Tests;

internal sealed class DesktopCompatibilityWarningTestFactory(
    string nextMinimum = "0.7.0",
    string nextServer = "0.8.0",
    string? latestVersion = null) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureLogging(logging => logging.ClearProviders());
        builder.UseEnvironment("Development");
        builder.UseSetting("UseInMemoryStorage", "true");
        builder.UseSetting("JWT_SECRET_KEY", "compatibility-warning-tests-secret-key-minimum-32-chars");
        builder.UseSetting("Auth:OAuthEnabled", "false");
        builder.UseSetting($"{ClientCompatibilityOptions.SectionName}:ServerVersion", "0.6.4");
        builder.UseSetting($"{ClientCompatibilityOptions.SectionName}:Desktop:MinVersion", "0.6.4");
        builder.UseSetting($"{ClientCompatibilityOptions.SectionName}:Desktop:NextMinVersion", nextMinimum);
        builder.UseSetting($"{ClientCompatibilityOptions.SectionName}:Desktop:NextServerVersion", nextServer);
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IDesktopUpdateVersionService>();
            services.AddSingleton<IDesktopUpdateVersionService>(new DesktopUpdateVersionServiceStub(latestVersion));
        });
    }
}
