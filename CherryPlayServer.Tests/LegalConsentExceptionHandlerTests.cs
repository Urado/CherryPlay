using System.Net;
using System.Text.Json;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Tests;

[TestFixture]
public class LegalConsentExceptionHandlerTests
{
    [Test]
    public async Task TryHandleAsync_Validation_Returns400WithDetail()
    {
        var (statusCode, problem, logLevel) = await HandleAsync(
            new LegalConsentException(LegalConsentFailureKind.Validation, "Consents are required."));

        Assert.That(statusCode, Is.EqualTo((int)HttpStatusCode.BadRequest));
        Assert.That(problem.Status, Is.EqualTo(400));
        Assert.That(problem.Detail, Is.EqualTo("Consents are required."));
        Assert.That(logLevel, Is.EqualTo(LogLevel.Warning));
    }

    [Test]
    public async Task TryHandleAsync_Conflict_Returns409WithDetail()
    {
        var (statusCode, problem, logLevel) = await HandleAsync(
            new LegalConsentException(LegalConsentFailureKind.Conflict, "Email is already registered."));

        Assert.That(statusCode, Is.EqualTo((int)HttpStatusCode.Conflict));
        Assert.That(problem.Status, Is.EqualTo(409));
        Assert.That(problem.Detail, Is.EqualTo("Email is already registered."));
        Assert.That(logLevel, Is.EqualTo(LogLevel.Warning));
    }

    private static async Task<(int StatusCode, ProblemDetails Problem, LogLevel LogLevel)> HandleAsync(
        LegalConsentException exception)
    {
        var logger = new CapturingLogger();
        var handler = new GlobalExceptionHandler(logger);
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        var handled = await handler.TryHandleAsync(context, exception, CancellationToken.None);
        Assert.That(handled, Is.True);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var json = await reader.ReadToEndAsync();
        var problem = JsonSerializer.Deserialize<ProblemDetails>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        Assert.That(problem, Is.Not.Null);
        Assert.That(logger.LastLevel, Is.Not.Null);
        return (context.Response.StatusCode, problem!, logger.LastLevel!.Value);
    }

    private sealed class CapturingLogger : ILogger<GlobalExceptionHandler>
    {
        public LogLevel? LastLevel { get; private set; }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => NullScope.Instance;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            LastLevel = logLevel;
        }

        private sealed class NullScope : IDisposable
        {
            public static readonly NullScope Instance = new();
            public void Dispose()
            {
            }
        }
    }
}
