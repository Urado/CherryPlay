using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Options;
using CherryPlayServer.Core.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Tests;

internal sealed class HangingDesktopReleaseWebApplicationFactory(
    Func<CancellationToken, Task<string?>> getVersion) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureLogging(logging => logging.ClearProviders());
        builder.UseEnvironment("Development");
        builder.UseSetting("UseInMemoryStorage", "true");
        builder.UseSetting("JWT_SECRET_KEY", "desktop-update-hang-tests-secret-key-minimum-32-chars");
        builder.UseSetting("Auth:OAuthEnabled", "false");
        builder.UseSetting($"{ClientCompatibilityOptions.SectionName}:ServerVersion", "0.6.4");
        builder.UseSetting($"{ClientCompatibilityOptions.SectionName}:Desktop:MinVersion", "0.6.4");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IDesktopReleaseSource>();
            services.RemoveAll<IDesktopUpdateVersionService>();
            services.AddSingleton<IDesktopReleaseSource>(new DesktopReleaseSourceStub(getVersion));
            services.AddSingleton<IDesktopUpdateVersionService, DesktopUpdateVersionService>();
        });
    }
}
