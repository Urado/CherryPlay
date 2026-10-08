using System.Net;
using System.Text.Json;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace CherryPlayServer.Core.Middleware;

public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        HttpStatusCode statusCode;
        string title;
        var logLevel = LogLevel.Error;

        if (exception is LegalConsentException legalConsentException
            && legalConsentException.Kind == LegalConsentFailureKind.ConsentRequired)
        {
            _logger.LogWarning(
                "Unhandled exception occurred: {FailureType}, failureLocation={FailureLocation}",
                exception.GetType().Name,
                CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(exception));

            httpContext.Response.StatusCode = (int)HttpStatusCode.Forbidden;
            httpContext.Response.ContentType = "application/json";

            var body = new
            {
                code = "consent_required",
                message = "Consent required",
                missing = (legalConsentException.Missing ?? Array.Empty<Guid>())
                    .Select(id => id.ToString())
                    .ToArray()
            };

            var consentJson = JsonSerializer.Serialize(body, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            await httpContext.Response.WriteAsync(consentJson, cancellationToken);
            return true;
        }

        if (exception is LegalConsentException legalConsent)
        {
            (statusCode, title, logLevel) = MapLegalConsent(legalConsent.Kind);
        }
        else if (exception is UnauthorizedAccessException)
        {
            statusCode = HttpStatusCode.Unauthorized;
            title = "Unauthorized";
        }
        else if (exception is ForbiddenException || exception is PartyLimitReachedException)
        {
            statusCode = HttpStatusCode.Forbidden;
            title = "Forbidden";
        }
        else if (exception is PartyNotFoundException)
        {
            statusCode = HttpStatusCode.NotFound;
            title = "Party Not Found";
        }
        else if (exception is ArgumentNullException)
        {
            statusCode = HttpStatusCode.BadRequest;
            title = "Invalid Argument";
        }
        else if (exception is ArgumentException)
        {
            statusCode = HttpStatusCode.BadRequest;
            title = "Invalid Argument";
        }
        else if (exception is InvalidOperationException)
        {
            statusCode = HttpStatusCode.BadRequest;
            title = "Invalid Operation";
        }
        else
        {
            statusCode = HttpStatusCode.InternalServerError;
            title = "An error occurred";
        }

        _logger.Log(
            logLevel,
            "Unhandled exception occurred: {FailureType}, failureLocation={FailureLocation}",
            exception.GetType().Name,
            CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(exception));

        var problemDetails = new ProblemDetails
        {
            Status = (int)statusCode,
            Title = title,
            Detail = exception.Message
        };

        httpContext.Response.StatusCode = (int)statusCode;
        httpContext.Response.ContentType = "application/json";

        var json = JsonSerializer.Serialize(problemDetails, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await httpContext.Response.WriteAsync(json, cancellationToken);
        return true;
    }

    private static (HttpStatusCode StatusCode, string Title, LogLevel LogLevel) MapLegalConsent(
        LegalConsentFailureKind kind)
    {
        return kind switch
        {
            LegalConsentFailureKind.Validation => (
                HttpStatusCode.BadRequest,
                "Validation Failed",
                LogLevel.Warning),
            LegalConsentFailureKind.Conflict => (
                HttpStatusCode.Conflict,
                "Conflict",
                LogLevel.Warning),
            LegalConsentFailureKind.NotFound => (
                HttpStatusCode.NotFound,
                "Not Found",
                LogLevel.Warning),
            LegalConsentFailureKind.ConsentRequired => (
                HttpStatusCode.Forbidden,
                "Consent Required",
                LogLevel.Warning),
            _ => (
                HttpStatusCode.InternalServerError,
                "An error occurred",
                LogLevel.Error)
        };
    }
}
