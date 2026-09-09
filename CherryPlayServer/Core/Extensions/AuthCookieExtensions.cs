using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace CherryPlayServer.Core.Extensions;

public static class AuthCookieExtensions
{
    public static CookieOptions CreateAuthCookieOptions(this HttpRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        var environment = request.HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>();
        var isProduction = !environment.IsDevelopment();

        return new CookieOptions
        {
            HttpOnly = true,
            Secure = isProduction || request.IsHttps,
            SameSite = (isProduction && request.IsHttps) ? SameSiteMode.None : SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(AuthConstants.TokenLifetimeDays)
        };
    }
}
