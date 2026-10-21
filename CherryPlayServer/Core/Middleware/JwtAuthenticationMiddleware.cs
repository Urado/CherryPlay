using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Extensions;
using Microsoft.Extensions.Configuration;

namespace CherryPlayServer.Core.Middleware;

public class JwtAuthenticationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<JwtAuthenticationMiddleware> _logger;

    public JwtAuthenticationMiddleware(RequestDelegate next, ILogger<JwtAuthenticationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(
        HttpContext context,
        IJwtService jwtService,
        IOrganizerRepository organizerRepository,
        IOrganizerSessionRepository sessionRepository,
        IConfiguration configuration)
    {
        var authorizationHeader = context.Request.Headers.Authorization.FirstOrDefault();
        var hasCookieToken = context.Request.Cookies.ContainsKey(AuthConstants.AuthCookieName);
        var isBearerRequest = authorizationHeader?.StartsWith(AuthConstants.BearerPrefix, StringComparison.OrdinalIgnoreCase) == true
            && authorizationHeader[AuthConstants.BearerPrefix.Length..].Trim().Length > 0;

        if (!IsSafeMethod(context.Request.Method) && hasCookieToken && !isBearerRequest && !HasTrustedOrigin(context.Request, configuration))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.CompleteAsync();
            return;
        }

        var token = context.ExtractTokenFromRequest();
        if (token is null)
        {
            context.Items["AuthenticationFailed"] = true;
        }

        if (!string.IsNullOrEmpty(token))
        {
            try
            {
                var validationResult = await jwtService.ValidateTokenAsync(token);
                if (validationResult.IsValid && validationResult.OrganizerId.HasValue)
                {
                    var organizer = await organizerRepository.GetByIdAsync(validationResult.OrganizerId.Value);
                    if (organizer == null)
                    {
                        _logger.LogWarning("Token validation succeeded but organizer was not found in database");
                        context.Items["AuthenticationFailed"] = true;
                    }
                    else
                    {
                        if (validationResult.SessionId is not Guid sessionId)
                        {
                            context.Items["AuthenticationFailed"] = true;
                        }
                        else
                        {
                            var session = await sessionRepository.GetByIdAsync(sessionId);
                            if (session?.OrganizerId != validationResult.OrganizerId.Value)
                            {
                                context.Items["AuthenticationFailed"] = true;
                            }
                            else
                            {
                                context.Items["OrganizerId"] = validationResult.OrganizerId.Value;
                                context.Items["OrganizerName"] = validationResult.Name;
                                context.Items["OrganizerRole"] = validationResult.Role ?? "organizer";
                                context.Items["SessionId"] = sessionId;
                            }
                        }
                    }
                }
                else
                {
                    context.Items["AuthenticationFailed"] = true;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Failed to validate JWT token: {FailureType}", ex.GetType().Name);
                context.Items["AuthenticationFailed"] = true;
            }
        }

        await _next(context);
    }

    private static bool IsSafeMethod(string method) =>
        HttpMethods.IsGet(method)
        || HttpMethods.IsHead(method)
        || HttpMethods.IsOptions(method);

    private static bool HasTrustedOrigin(HttpRequest request, IConfiguration configuration)
    {
        var origins = request.Headers.Origin;
        Uri origin;
        if (origins.Count == 0)
        {
            var referers = request.Headers["Referer"];
            if (referers.Count != 1 || !Uri.TryCreate(referers[0], UriKind.Absolute, out var referer)
                || !IsHttpOrigin(referer) || !string.IsNullOrEmpty(referer.UserInfo))
            {
                return false;
            }

            origin = new Uri(referer.GetLeftPart(UriPartial.Authority));
        }
        else
        {
            if (origins.Count != 1
                || !Uri.TryCreate(origins[0], UriKind.Absolute, out var parsedOrigin)
                || parsedOrigin is null
                || !IsHttpOrigin(parsedOrigin)
                || !string.IsNullOrEmpty(parsedOrigin.UserInfo)
                || parsedOrigin.AbsolutePath != "/"
                || parsedOrigin.Query.Length != 0
                || parsedOrigin.Fragment.Length != 0)
            {
                return false;
            }

            origin = parsedOrigin;
        }

        if (Uri.TryCreate($"{request.Scheme}://{request.Host.Value}", UriKind.Absolute, out var requestOrigin)
            && IsHttpOrigin(requestOrigin)
            && SameOrigin(origin, requestOrigin))
        {
            return true;
        }

        var trustedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        var publicWebUrl = configuration["PUBLIC_WEB_BASE_URL"];
        if (Uri.TryCreate(publicWebUrl, UriKind.Absolute, out var publicWebOrigin)
            && IsHttpOrigin(publicWebOrigin)
            && string.IsNullOrEmpty(publicWebOrigin.UserInfo))
        {
            trustedOrigins = [.. trustedOrigins, publicWebOrigin.GetLeftPart(UriPartial.Authority)];
        }

        return trustedOrigins.Any(value => Uri.TryCreate(value, UriKind.Absolute, out var trustedOrigin)
            && IsHttpOrigin(trustedOrigin)
            && string.IsNullOrEmpty(trustedOrigin.UserInfo)
            && trustedOrigin.AbsolutePath == "/"
            && trustedOrigin.Query.Length == 0
            && trustedOrigin.Fragment.Length == 0
            && SameOrigin(origin, trustedOrigin));
    }

    private static bool IsHttpOrigin(Uri uri) =>
        uri.Scheme.Equals(Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
        || uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);

    private static bool SameOrigin(Uri left, Uri right) =>
        string.Equals(left.Scheme, right.Scheme, StringComparison.OrdinalIgnoreCase)
        && string.Equals(left.Host, right.Host, StringComparison.OrdinalIgnoreCase)
        && left.Port == right.Port;
}
