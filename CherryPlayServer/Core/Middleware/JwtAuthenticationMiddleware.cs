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
                    // Проверяем, существует ли организатор в базе данных
                    var organizer = await organizerRepository.GetByIdAsync(validationResult.OrganizerId.Value);
                    if (organizer == null)
                    {
                        _logger.LogWarning(
                            "Token validation succeeded but organizer {OrganizerId} not found in database",
                            validationResult.OrganizerId.Value);
                        // Не устанавливаем OrganizerId в контексте, чтобы авторизация не прошла
                    }
                    else
                    {
                        // Организатор существует — устанавливаем контекст (SessionId проверяется в OrganizerAuthorizationHandler)
                        context.Items["OrganizerId"] = validationResult.OrganizerId.Value;
                        context.Items["OrganizerName"] = validationResult.Name;
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
