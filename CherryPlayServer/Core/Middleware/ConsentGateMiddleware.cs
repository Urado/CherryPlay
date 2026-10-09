using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Core.Middleware;

public class ConsentGateMiddleware
{
    private static readonly HashSet<string> MutatingMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        HttpMethods.Post,
        HttpMethods.Put,
        HttpMethods.Patch,
        HttpMethods.Delete
    };

    private static readonly string[] ExemptPathPrefixes =
    [
        "/api/consent-events",
        "/api/admin",
        "/auth/"
    ];

    private readonly RequestDelegate _next;

    public ConsentGateMiddleware(RequestDelegate next)
    {
        _next = next ?? throw new ArgumentNullException(nameof(next));
    }

    public async Task InvokeAsync(HttpContext context, ILegalDocumentsService legalDocuments)
    {
        if (ShouldEnforce(context))
        {
            var organizerId = context.GetOrganizerId();
            if (organizerId.HasValue)
            {
                var missing = await legalDocuments.GetMissingRequiredGrantsAsync(
                    organizerId.Value,
                    context.RequestAborted);
                if (missing.Count > 0)
                {
                    throw new LegalConsentException(
                        LegalConsentFailureKind.ConsentRequired,
                        "Consent required",
                        missing);
                }
            }
        }

        await _next(context);
    }

    private static bool ShouldEnforce(HttpContext context)
    {
        if (
            HttpMethods.IsDelete(context.Request.Method)
            && context.Request.Path.Equals("/api/organizer/account", StringComparison.OrdinalIgnoreCase)
        )
        {
            return false;
        }

        if (!MutatingMethods.Contains(context.Request.Method))
        {
            return false;
        }

        var path = context.Request.Path.Value ?? string.Empty;
        foreach (var prefix in ExemptPathPrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        if (path.Equals("/auth", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return true;
    }
}
