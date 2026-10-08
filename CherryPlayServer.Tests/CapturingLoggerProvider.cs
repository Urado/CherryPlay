using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Tests;

internal sealed class CapturingLoggerProvider : ILoggerProvider, ILogger
{
    private readonly List<string> _messages = [];

    public IReadOnlyList<string> Messages => _messages;

    public ILogger CreateLogger(string categoryName) => this;

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        _messages.Add(formatter(state, exception));
    }

    public void Dispose()
    {
    }
}
