using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Enums;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace CherryPlayServer.Core.Extensions;

public static class OAuthRedirectUri
{
    public static string BuildCanonical(
        string provider,
        IConfiguration configuration,
        HttpRequest? request = null)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        if (string.IsNullOrWhiteSpace(provider))
        {
            throw new ArgumentException("Provider is required.", nameof(provider));
        }

        var providerSegment = provider.Trim().ToLowerInvariant();
        var configured = configuration["OAUTH_REDIRECT_BASE_URL"];
        string baseUrl;
        if (!string.IsNullOrWhiteSpace(configured))
        {
            baseUrl = configured.Trim().TrimEnd('/');
        }
        else if (request is not null)
        {
            baseUrl = $"{request.Scheme}://{request.Host}".TrimEnd('/');
        }
        else
        {
            throw new LegalConsentException(
                LegalConsentFailureKind.Validation,
                "OAuth redirect base URL is not configured.");
        }

        return $"{baseUrl}/auth/{providerSegment}/callback";
    }

    public static string ResolveForExchange(
        string provider,
        string? clientRedirectUri,
        IConfiguration configuration,
        HttpRequest? request = null)
    {
        var canonical = BuildCanonical(provider, configuration, request);
        if (string.IsNullOrWhiteSpace(clientRedirectUri))
        {
            return canonical;
        }

        if (!string.Equals(clientRedirectUri.Trim(), canonical, StringComparison.Ordinal))
        {
            throw new LegalConsentException(
                LegalConsentFailureKind.Validation,
                "RedirectUri does not match the canonical OAuth callback URI.");
        }

        return canonical;
    }
}
