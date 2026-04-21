using System.Linq;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;

namespace CherryPlayServer.Core.Authorization;

public class OrganizerAuthorizationResultHandler : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler _defaultHandler = new();

    public async Task HandleAsync(
        RequestDelegate next,
        HttpContext context,
        AuthorizationPolicy policy,
        PolicyAuthorizationResult authorizeResult)
    {
        var hasOrganizerRequirement = policy.Requirements.Any(r => r is OrganizerRequirement);
        var hasAdminRequirement = policy.Requirements.Any(r => r is AdminRequirement);

        if (authorizeResult.Challenged && hasOrganizerRequirement)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            var body = JsonSerializer.Serialize(new { title = "Unauthorized", detail = "Authentication required" },
                new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            await context.Response.WriteAsync(body);
            return;
        }

        if (authorizeResult.Challenged && hasAdminRequirement)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            var body = JsonSerializer.Serialize(new { code = "admin_only", message = "Admin access required" },
                new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            await context.Response.WriteAsync(body);
            return;
        }

        if (authorizeResult.Forbidden &&
            authorizeResult.AuthorizationFailure?.FailedRequirements?.Any(r => r is OrganizerRequirement) == true)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            var body = JsonSerializer.Serialize(new { title = "Unauthorized", detail = "Authentication required" },
                new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            await context.Response.WriteAsync(body);
            return;
        }
        if (authorizeResult.Forbidden &&
            authorizeResult.AuthorizationFailure?.FailedRequirements?.Any(r => r is AdminRequirement) == true)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            var body = JsonSerializer.Serialize(new { code = "admin_only", message = "Admin access required" },
                new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            await context.Response.WriteAsync(body);
            return;
        }

        await _defaultHandler.HandleAsync(next, context, policy, authorizeResult);
    }
}
