using CherryPlayServer.Controllers;
using CherryPlayServer.Core.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

internal static class AuthControllerTestFactory
{
    public static AuthController Create(
        IAuthService authService,
        Guid? organizerId = null,
        IDesktopAuthCodeService? desktopAuthCodeService = null,
        IOAuthStateService? oauthStateService = null,
        Action<DefaultHttpContext>? configureHttpContext = null,
        IConfiguration? configuration = null)
    {
        var services = new ServiceCollection();
        services.AddSingleton<IWebHostEnvironment>(new AuthControllerTestWebHostEnvironment());
        var httpContext = new DefaultHttpContext
        {
            RequestServices = services.BuildServiceProvider(),
        };

        if (organizerId.HasValue)
        {
            httpContext.Items["OrganizerId"] = organizerId.Value;
        }

        configureHttpContext?.Invoke(httpContext);

        return new AuthController(
            authService,
            new UnusedOAuthService(),
            oauthStateService ?? new DefaultStubOAuthStateService(),
            desktopAuthCodeService ?? new UnusedDesktopAuthCodeService(),
            new TestOrganizerSessionRepository(),
            configuration ?? new ConfigurationBuilder().Build(),
            NullLogger<AuthController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = httpContext,
            },
        };
    }
}

internal sealed class DefaultStubOAuthStateService : IOAuthStateService
{
    public string GenerateAndStoreState(string provider, string? client = null, string? returnTo = null) => "state";

    public bool ValidateAndConsumeState(string? state, string expectedProvider) => true;
}

internal sealed class ConfigurableOAuthStateService : IOAuthStateService
{
    public OAuthStateConsumeResult? ConsumeResult { get; set; }

    public string GenerateAndStoreState(string provider, string? client = null, string? returnTo = null) => "state";

    public bool ValidateAndConsumeState(string? state, string expectedProvider) => ConsumeResult != null;

    public OAuthStateConsumeResult? ValidateAndConsumeStateWithClient(string? state, string expectedProvider) =>
        ConsumeResult;
}

internal sealed class UnusedDesktopAuthCodeService : IDesktopAuthCodeService
{
    public Task<string> IssueCodeAsync(Guid organizerId) => Task.FromResult("unused");

    public Task<string?> ExchangeAsync(string rawCode) => Task.FromResult<string?>(null);
}

internal sealed class AuthControllerTestWebHostEnvironment : IWebHostEnvironment
{
    public string EnvironmentName { get; set; } = Environments.Development;
    public string ApplicationName { get; set; } = "CherryPlayServer.Tests";
    public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
    public string WebRootPath { get; set; } = AppContext.BaseDirectory;
    public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } =
        new Microsoft.Extensions.FileProviders.NullFileProvider();
    public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } =
        new Microsoft.Extensions.FileProviders.NullFileProvider();
}
