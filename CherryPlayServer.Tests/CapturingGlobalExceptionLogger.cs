using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Tests;

public sealed class CapturingGlobalExceptionLogger : ILogger<CherryPlayServer.Core.Middleware.GlobalExceptionHandler>
{
    public string Message { get; private set; } = string.Empty;
    public Exception? Exception { get; private set; }

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        Message = formatter(state, exception);
        Exception = exception;
    }
}
