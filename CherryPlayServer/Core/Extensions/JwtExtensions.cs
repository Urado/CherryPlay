using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core;
using Microsoft.AspNetCore.Http;

namespace CherryPlayServer.Core.Extensions;

public static class JwtExtensions
{
    /// <summary>
    /// Validates JWT token and sets OrganizerId in HttpContext.Items if valid.
    /// Returns true if token is valid and organizer ID was set.
    /// </summary>
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
            // Validation failed, return false
        }

        return false;
    }

    /// <summary>
    /// Extracts JWT token from Authorization header or cookie.
    /// </summary>
    public static string? ExtractTokenFromRequest(this HttpContext context)
    {
        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
        if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith(AuthConstants.BearerPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return authHeader.Remove(0, AuthConstants.BearerPrefix.Length).Trim();
        }

        return context.Request.Cookies[AuthConstants.AuthCookieName];
    }
}
