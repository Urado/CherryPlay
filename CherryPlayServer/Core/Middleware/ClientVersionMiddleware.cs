using System.Text.Json;
using CherryPlayServer.Core.Options;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Core.Middleware;

public class ClientVersionMiddleware
{
    public const string ClientVersionHeaderName = "X-Client-Version";
    public const string ClientAppHeaderName = "X-Client-App";

    public const string ClientAppWeb = "web";
    public const string ClientAppDesktop = "desktop";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly RequestDelegate _next;
    private readonly ClientCompatibilityOptions _options;
    private readonly ILogger<ClientVersionMiddleware> _logger;

    public ClientVersionMiddleware(
        RequestDelegate next,
        IOptions<ClientCompatibilityOptions> options,
        ILogger<ClientVersionMiddleware> logger)
    {
        _next = next;
        _options = options.Value;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!ShouldCheckVersion(context.Request.Path))
        {
            await _next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue(ClientVersionHeaderName, out var versionHeaderValues))
        {
            await _next(context);
            return;
        }

        var clientVersion = versionHeaderValues.Count > 0 ? versionHeaderValues[0]! : string.Empty;
        if (string.IsNullOrWhiteSpace(clientVersion))
        {
            await _next(context);
            return;
        }

        if (!SemverComparer.TryParse(clientVersion, out var parsedClientVersion))
        {
            await WriteErrorAsync(
                context,
                StatusCodes.Status400BadRequest,
                "Bad Request",
                "Invalid client version format.",
                "client_version_invalid");
            return;
        }

        if (!context.Request.Headers.TryGetValue(ClientAppHeaderName, out var appHeaderValues))
        {
            await _next(context);
            return;
        }

        var clientApp = appHeaderValues.Count > 0 ? appHeaderValues[0]! : string.Empty;
        if (string.IsNullOrWhiteSpace(clientApp))
        {
            await _next(context);
            return;
        }

        if (clientApp.Equals(ClientAppWeb, StringComparison.OrdinalIgnoreCase))
        {
            if (!TryGetRequiredWebVersion(out var requiredWebVersion, out var parsedRequiredWebVersion))
            {
                await _next(context);
                return;
            }

            if (SemverComparer.Compare(parsedClientVersion, parsedRequiredWebVersion) != 0)
            {
                await WriteErrorAsync(
                    context,
                    StatusCodes.Status426UpgradeRequired,
                    "Upgrade Required",
                    "Web client version must match the server version.",
                    "client_outdated",
                    requiredVersion: requiredWebVersion);
                return;
            }
        }
        else if (clientApp.Equals(ClientAppDesktop, StringComparison.OrdinalIgnoreCase))
        {
            if (!TryGetRequiredDesktopVersion(out var requiredDesktopVersion, out var parsedRequiredDesktopVersion))
            {
                await _next(context);
                return;
            }

            if (SemverComparer.CompareMajorMinor(parsedClientVersion, parsedRequiredDesktopVersion) < 0)
            {
                await WriteErrorAsync(
                    context,
                    StatusCodes.Status426UpgradeRequired,
                    "Upgrade Required",
                    "Desktop client version is below the minimum required version.",
                    "client_outdated",
                    requiredVersion: requiredDesktopVersion);
                return;
            }
        }
        else
        {
            await WriteErrorAsync(
                context,
                StatusCodes.Status400BadRequest,
                "Bad Request",
                $"Unknown client app type. Supported values: {ClientAppWeb}, {ClientAppDesktop}.",
                "client_app_invalid");
            return;
        }

        await _next(context);
    }

    private bool TryGetRequiredWebVersion(out string requiredVersion, out SemverComparer.VersionTriple parsed)
    {
        requiredVersion = _options.ServerVersion;
        if (SemverComparer.TryParse(requiredVersion, out parsed))
            return true;

        _logger.LogError(
            "ClientCompatibility:ServerVersion '{ServerVersion}' is not a valid semver; skipping web version check",
            requiredVersion);
        parsed = default;
        return false;
    }

    private bool TryGetRequiredDesktopVersion(out string requiredVersion, out SemverComparer.VersionTriple parsed)
    {
        requiredVersion = _options.Desktop.MinVersion;
        if (SemverComparer.TryParse(requiredVersion, out parsed))
            return true;

        _logger.LogError(
            "ClientCompatibility:Desktop:MinVersion '{MinVersion}' is not a valid semver; skipping desktop version check",
            requiredVersion);
        parsed = default;
        return false;
    }

    public static bool ShouldCheckVersion(PathString path)
    {
        if (!path.HasValue)
            return false;

        var requestPath = path.Value!;

        if (requestPath.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase))
            return false;

        if (requestPath.StartsWith("/partyHub", StringComparison.OrdinalIgnoreCase))
            return false;

        if (IsExactOrSubPath(requestPath, "/api/health"))
            return false;

        if (IsExactOrSubPath(requestPath, "/api/config"))
            return false;

        if (requestPath.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
            return true;

        if (requestPath.Equals("/auth", StringComparison.OrdinalIgnoreCase)
            || requestPath.StartsWith("/auth/", StringComparison.OrdinalIgnoreCase))
            return true;

        return false;
    }

    private static bool IsExactOrSubPath(string requestPath, string basePath)
    {
        return requestPath.Equals(basePath, StringComparison.OrdinalIgnoreCase)
            || requestPath.StartsWith(basePath + "/", StringComparison.OrdinalIgnoreCase);
    }

    private static async Task WriteErrorAsync(
        HttpContext context,
        int statusCode,
        string title,
        string detail,
        string code,
        string? requiredVersion = null)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var payload = requiredVersion is null
            ? new { status = statusCode, title, detail, code }
            : (object)new { status = statusCode, title, detail, code, requiredVersion };

        await context.Response.WriteAsync(JsonSerializer.Serialize(payload, JsonOptions));
    }
}
