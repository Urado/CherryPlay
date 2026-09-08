using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Options;
using Microsoft.Extensions.Options;

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
    private readonly ConsentGateOptions _options;

    public ConsentGateMiddleware(RequestDelegate next, IOptions<ConsentGateOptions> options)
    {
        _next = next;
        _options = options?.Value ?? throw new ArgumentNullException(nameof(options));
    }

    public async Task InvokeAsync(HttpContext context, ILegalDocumentsService legalDocuments)
    {
        // Fail-open when consent storage is unsupported (EF / UnsupportedLegalConsentUnitOfWork):
        // otherwise InMemory required docs would 403 every write with no grant path.
        if (_options.Enabled && ShouldEnforce(context))
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

        // Exact /auth (no trailing slash) — keep auth surface usable without grants.
        if (path.Equals("/auth", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return true;
    }
}
