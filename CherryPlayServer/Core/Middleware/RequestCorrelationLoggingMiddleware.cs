using System.Diagnostics;

namespace CherryPlayServer.Core.Middleware;

public sealed class RequestCorrelationLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestCorrelationLoggingMiddleware> _logger;

    public RequestCorrelationLoggingMiddleware(
        RequestDelegate next,
        ILogger<RequestCorrelationLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        Activity? requestActivity = null;
        var activity = Activity.Current;

        if (activity is null)
        {
            requestActivity = new Activity("CherryPlayServer.HttpRequest");
            requestActivity.SetIdFormat(ActivityIdFormat.W3C);

            if (ActivityContext.TryParse(
                context.Request.Headers.TraceParent.ToString(),
                context.Request.Headers.TraceState.ToString(),
                out var parentContext))
            {
                requestActivity.SetParentId(
                    parentContext.TraceId,
                    parentContext.SpanId,
                    parentContext.TraceFlags);
            }

            activity = requestActivity.Start();
        }

        var scope = new Dictionary<string, object?>
        {
            ["TraceId"] = activity.TraceId.ToHexString(),
            ["SpanId"] = activity.SpanId.ToHexString(),
            ["RequestId"] = context.TraceIdentifier
        };

        try
        {
            using (_logger.BeginScope(scope))
            {
                await _next(context);
            }
        }
        finally
        {
            requestActivity?.Stop();
        }
    }
}
