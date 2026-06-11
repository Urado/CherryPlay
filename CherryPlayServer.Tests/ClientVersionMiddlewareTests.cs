using System.Net;
using System.Text.Json;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Middleware;
using CherryPlayServer.Core.Options;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Tests;

[TestFixture]
public class ClientVersionMiddlewareTests
{
    [TestCase("1.0.0", 1, 0, 0)]
    [TestCase("v2.3.4", 2, 3, 4)]
    [TestCase("V0.0.1", 0, 0, 1)]
    public void TryParse_ValidSemver_ReturnsTrue(string input, int major, int minor, int patch)
    {
        var success = SemverComparer.TryParse(input, out var parsed);

        Assert.That(success, Is.True);
        Assert.That(parsed, Is.EqualTo(new SemverComparer.VersionTriple(major, minor, patch)));
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("   ")]
    [TestCase("1.0")]
    [TestCase("1.0.0.0")]
    [TestCase("not-a-version")]
    [TestCase("v1.0-beta")]
    public void TryParse_InvalidSemver_ReturnsFalse(string? input)
    {
        Assert.That(SemverComparer.TryParse(input, out _), Is.False);
    }

    [TestCase("1.0.0", "1.0.0", 0)]
    [TestCase("1.0.1", "1.0.0", 1)]
    [TestCase("1.1.0", "1.0.9", 1)]
    [TestCase("2.0.0", "1.9.9", 1)]
    [TestCase("0.4.0", "0.5.0", -1)]
    public void Compare_Ordering_MatchesExpected(string left, string right, int expectedSign)
    {
        var comparison = SemverComparer.Compare(left, right);

        Assert.That(Math.Sign(comparison), Is.EqualTo(expectedSign));
    }

    [TestCase("/api/parties", true)]
    [TestCase("/api/health", false)]
    [TestCase("/api/config", false)]
    [TestCase("/auth/login", true)]
    [TestCase("/auth", true)]
    [TestCase("/partyHub", false)]
    [TestCase("/swagger/index.html", false)]
    [TestCase("/other", false)]
    public void ShouldCheckVersion_PathRules_MatchExpected(string path, bool expected)
    {
        Assert.That(ClientVersionMiddleware.ShouldCheckVersion(new PathString(path)), Is.EqualTo(expected));
    }

    [Test]
    public async Task InvokeAsync_MissingHeaders_AllowsRequest()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            },
            CreateOptions(serverVersion: "9.9.9", desktopMinVersion: "9.9.9"));

        var context = CreateHttpContext("/api/parties");

        await middleware.InvokeAsync(context);

        Assert.That(nextCalled, Is.True);
        Assert.That(context.Response.StatusCode, Is.EqualTo(StatusCodes.Status200OK));
    }

    [Test]
    public async Task InvokeAsync_MissingAppHeader_AllowsRequest()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            },
            CreateOptions(serverVersion: "1.0.0"));

        var context = CreateHttpContext("/api/parties", clientVersion: "0.1.0");

        await middleware.InvokeAsync(context);

        Assert.That(nextCalled, Is.True);
    }

    [Test]
    public async Task InvokeAsync_InvalidHeader_Returns400()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            },
            CreateOptions());

        var context = CreateHttpContext(
            "/api/parties",
            clientVersion: "bad-version",
            clientApp: ClientVersionMiddleware.ClientAppWeb);

        await middleware.InvokeAsync(context);

        Assert.That(nextCalled, Is.False);
        Assert.That(context.Response.StatusCode, Is.EqualTo(StatusCodes.Status400BadRequest));

        var body = await ReadResponseBodyAsync(context);
        using var json = JsonDocument.Parse(body);
        Assert.That(json.RootElement.GetProperty("code").GetString(), Is.EqualTo("client_version_invalid"));
    }

    [Test]
    public async Task InvokeAsync_UnknownApp_Returns400()
    {
        var middleware = CreateMiddleware(_ => Task.CompletedTask, CreateOptions());
        var context = CreateHttpContext("/api/parties", clientVersion: "1.0.0", clientApp: "mobile");

        await middleware.InvokeAsync(context);

        Assert.That(context.Response.StatusCode, Is.EqualTo(StatusCodes.Status400BadRequest));
        var body = await ReadResponseBodyAsync(context);
        using var json = JsonDocument.Parse(body);
        Assert.That(json.RootElement.GetProperty("code").GetString(), Is.EqualTo("client_app_invalid"));
    }

    [Test]
    public async Task InvokeAsync_WebVersionMismatch_Returns426WithRequiredVersion()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            },
            CreateOptions(serverVersion: "1.2.0"));

        var context = CreateHttpContext(
            "/auth/login",
            clientVersion: "1.1.9",
            clientApp: ClientVersionMiddleware.ClientAppWeb);

        await middleware.InvokeAsync(context);

        Assert.That(nextCalled, Is.False);
        Assert.That(context.Response.StatusCode, Is.EqualTo(StatusCodes.Status426UpgradeRequired));

        var body = await ReadResponseBodyAsync(context);
        using var json = JsonDocument.Parse(body);
        Assert.That(json.RootElement.GetProperty("code").GetString(), Is.EqualTo("client_outdated"));
        Assert.That(json.RootElement.GetProperty("requiredVersion").GetString(), Is.EqualTo("1.2.0"));
    }

    [Test]
    public async Task InvokeAsync_WebVersionNewerThanServer_Returns426()
    {
        var middleware = CreateMiddleware(_ => Task.CompletedTask, CreateOptions(serverVersion: "1.0.0"));
        var context = CreateHttpContext(
            "/api/parties",
            clientVersion: "1.0.1",
            clientApp: ClientVersionMiddleware.ClientAppWeb);

        await middleware.InvokeAsync(context);

        Assert.That(context.Response.StatusCode, Is.EqualTo(StatusCodes.Status426UpgradeRequired));
    }

    [Test]
    public async Task InvokeAsync_WebVersionMatchesServer_AllowsRequest()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            },
            CreateOptions(serverVersion: "1.0.0"));

        var context = CreateHttpContext(
            "/api/parties",
            clientVersion: "v1.0.0",
            clientApp: ClientVersionMiddleware.ClientAppWeb);

        await middleware.InvokeAsync(context);

        Assert.That(nextCalled, Is.True);
    }

    [Test]
    public async Task InvokeAsync_DesktopOutdatedVersion_Returns426WithRequiredVersion()
    {
        var middleware = CreateMiddleware(
            _ => Task.CompletedTask,
            CreateOptions(desktopMinVersion: "0.5.0"));

        var context = CreateHttpContext(
            "/auth/login",
            clientVersion: "0.4.9",
            clientApp: ClientVersionMiddleware.ClientAppDesktop);

        await middleware.InvokeAsync(context);

        Assert.That(context.Response.StatusCode, Is.EqualTo(StatusCodes.Status426UpgradeRequired));

        var body = await ReadResponseBodyAsync(context);
        using var json = JsonDocument.Parse(body);
        Assert.That(json.RootElement.GetProperty("code").GetString(), Is.EqualTo("client_outdated"));
        Assert.That(json.RootElement.GetProperty("requiredVersion").GetString(), Is.EqualTo("0.5.0"));
    }

    [Test]
    public async Task InvokeAsync_DesktopSufficientVersion_AllowsRequest()
    {
        var nextCalled = false;
        var middleware = CreateMiddleware(
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            },
            CreateOptions(desktopMinVersion: "0.4.0"));

        var context = CreateHttpContext(
            "/api/parties",
            clientVersion: "0.4.0",
            clientApp: ClientVersionMiddleware.ClientAppDesktop);

        await middleware.InvokeAsync(context);

        Assert.That(nextCalled, Is.True);
    }

    [Test]
    public async Task Integration_HealthEndpoint_IgnoresClientVersionHeader()
    {
        await using var factory = new ClientVersionTestWebApplicationFactory("1.0.0", "0.5.0");
        using var client = factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/health");
        request.Headers.Add(ClientVersionMiddleware.ClientVersionHeaderName, "0.1.0");
        request.Headers.Add(ClientVersionMiddleware.ClientAppHeaderName, ClientVersionMiddleware.ClientAppDesktop);

        var response = await client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
    }

    [Test]
    public async Task Integration_DesktopOutdatedClientVersion_Returns426()
    {
        await using var factory = new ClientVersionTestWebApplicationFactory("1.0.0", "1.5.0");
        using var client = factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/parties/public");
        request.Headers.Add(ClientVersionMiddleware.ClientVersionHeaderName, "1.4.9");
        request.Headers.Add(ClientVersionMiddleware.ClientAppHeaderName, ClientVersionMiddleware.ClientAppDesktop);

        var response = await client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo((HttpStatusCode)426));

        var body = await response.Content.ReadAsStringAsync();
        using var json = JsonDocument.Parse(body);
        Assert.That(json.RootElement.GetProperty("code").GetString(), Is.EqualTo("client_outdated"));
        Assert.That(json.RootElement.GetProperty("requiredVersion").GetString(), Is.EqualTo("1.5.0"));
    }

    [Test]
    public async Task Integration_WebVersionMismatch_Returns426()
    {
        await using var factory = new ClientVersionTestWebApplicationFactory("2.0.0", "0.0.0");
        using var client = factory.CreateClient();

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/parties/public");
        request.Headers.Add(ClientVersionMiddleware.ClientVersionHeaderName, "1.9.9");
        request.Headers.Add(ClientVersionMiddleware.ClientAppHeaderName, ClientVersionMiddleware.ClientAppWeb);

        var response = await client.SendAsync(request);

        Assert.That(response.StatusCode, Is.EqualTo((HttpStatusCode)426));
    }

    private static ClientCompatibilityOptions CreateOptions(
        string serverVersion = "0.0.0",
        string desktopMinVersion = "0.0.0")
    {
        return new ClientCompatibilityOptions
        {
            ServerVersion = serverVersion,
            Desktop = new DesktopClientCompatibilityOptions
            {
                MinVersion = desktopMinVersion,
            },
        };
    }

    private static ClientVersionMiddleware CreateMiddleware(
        RequestDelegate next,
        ClientCompatibilityOptions options)
    {
        return new ClientVersionMiddleware(
            next,
            Options.Create(options),
            NullLogger<ClientVersionMiddleware>.Instance);
    }

    private static DefaultHttpContext CreateHttpContext(
        string path,
        string? clientVersion = null,
        string? clientApp = null)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Response.Body = new MemoryStream();

        if (clientVersion is not null)
            context.Request.Headers[ClientVersionMiddleware.ClientVersionHeaderName] = clientVersion;

        if (clientApp is not null)
            context.Request.Headers[ClientVersionMiddleware.ClientAppHeaderName] = clientApp;

        return context;
    }

    private static async Task<string> ReadResponseBodyAsync(HttpContext context)
    {
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        return await reader.ReadToEndAsync();
    }

    private sealed class ClientVersionTestWebApplicationFactory(
        string serverVersion,
        string desktopMinVersion) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("UseInMemoryStorage", "true");
            builder.UseSetting("JWT_SECRET_KEY", "client-version-tests-secret-key-minimum-32-chars");
            builder.UseSetting("Auth:OAuthEnabled", "false");
            builder.UseSetting($"{ClientCompatibilityOptions.SectionName}:ServerVersion", serverVersion);
            builder.UseSetting($"{ClientCompatibilityOptions.SectionName}:Desktop:MinVersion", desktopMinVersion);
        }
    }
}
