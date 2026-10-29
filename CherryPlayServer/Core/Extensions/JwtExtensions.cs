using CherryPlayServer.Core;
using CherryPlayServer.Core.Interfaces;
using Microsoft.AspNetCore.Http;

namespace CherryPlayServer.Core.Extensions;

public static class JwtExtensions
{
    public static async Task<bool> ValidateAndSetOrganizerContextAsync(
        this IJwtService jwtService,
        HttpContext context,
        string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        try
        {
            var validationResult = await jwtService.ValidateTokenAsync(token);
            if (validationResult.IsValid && validationResult.OrganizerId.HasValue)
            {
                context.Items["OrganizerId"] = validationResult.OrganizerId.Value;
                context.Items["OrganizerName"] = validationResult.Name;
                return true;
            }
        }
        catch
        {
            return false;
        }

        return false;
    }

    public static string? ExtractTokenFromRequest(this HttpContext context)
    {
        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(authHeader))
        {
            if (!authHeader.StartsWith(AuthConstants.BearerPrefix, StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            var token = authHeader[AuthConstants.BearerPrefix.Length..].Trim();
            return token.Length == 0 ? null : token;
        }

        return context.Request.Cookies[AuthConstants.AuthCookieName];
    }
}
