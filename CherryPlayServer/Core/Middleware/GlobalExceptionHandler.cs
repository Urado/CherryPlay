using System.Net;
using System.Text.Json;
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
        _logger.LogError(exception, "Unhandled exception occurred");

        HttpStatusCode statusCode;
        string title;

        if (exception is UnauthorizedAccessException)
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
}
