using System.Diagnostics;
using CherryPlayServer.Core.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class RequestCorrelationLoggingMiddlewareTests : ILogger<RequestCorrelationLoggingMiddleware>
{
    private Dictionary<string, object?>? _scope;

    [Test]
    public async Task InvokeAsync_LogsTraceAndRequestIdentifiersFromTraceParent()
    {
        var parentTraceId = ActivityTraceId.CreateRandom();
        var parentSpanId = ActivitySpanId.CreateRandom();
        var context = new DefaultHttpContext();
        context.TraceIdentifier = "request-id";
        context.Request.Headers.TraceParent = $"00-{parentTraceId}-{parentSpanId}-01";
        var middleware = new RequestCorrelationLoggingMiddleware(_ => Task.CompletedTask, this);

        await middleware.InvokeAsync(context);

        Assert.That(_scope, Is.Not.Null);
        Assert.That(_scope!["TraceId"], Is.EqualTo(parentTraceId.ToHexString()));
        Assert.That(_scope["SpanId"], Is.Not.EqualTo(parentSpanId.ToHexString()));
        Assert.That(_scope["RequestId"], Is.EqualTo("request-id"));
    }

    [Test]
    public async Task InvokeAsync_CreatesW3CIdentifiersWhenTraceParentIsMissing()
    {
        var context = new DefaultHttpContext();
        context.TraceIdentifier = "request-id";
        var middleware = new RequestCorrelationLoggingMiddleware(_ => Task.CompletedTask, this);

        await middleware.InvokeAsync(context);

        Assert.That(_scope, Is.Not.Null);
        Assert.That(_scope!["TraceId"], Is.Not.Null.And.Not.Empty);
        Assert.That(_scope["SpanId"], Is.Not.Null.And.Not.Empty);
        Assert.That(_scope["RequestId"], Is.EqualTo("request-id"));
    }

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull
    {
        _scope = state as Dictionary<string, object?>;
        return null;
    }

    public bool IsEnabled(LogLevel logLevel) => false;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
    }
}
