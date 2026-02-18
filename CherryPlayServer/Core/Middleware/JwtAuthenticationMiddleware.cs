using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Extensions;

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

    public async Task InvokeAsync(HttpContext context, IJwtService jwtService)
    {
        var token = context.ExtractTokenFromRequest();
        if (!string.IsNullOrEmpty(token))
        {
            try
            {
                await jwtService.ValidateAndSetOrganizerContextAsync(context, token);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to validate JWT token");
            }
        }

        await _next(context);
    }
}
