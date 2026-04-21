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

    public async Task InvokeAsync(HttpContext context, IJwtService jwtService, IOrganizerRepository organizerRepository)
    {
        var token = context.ExtractTokenFromRequest();
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
                        _logger.LogWarning(
                            "Token validation succeeded but organizer {OrganizerId} not found in database",
                            validationResult.OrganizerId.Value);
                    }
                    else
                    {
                        context.Items["OrganizerId"] = validationResult.OrganizerId.Value;
                        context.Items["OrganizerName"] = validationResult.Name;
                        context.Items["OrganizerRole"] = validationResult.Role ?? "organizer";
                        if (validationResult.SessionId.HasValue)
                            context.Items["SessionId"] = validationResult.SessionId.Value;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to validate JWT token");
            }
        }

        await _next(context);
    }
}
