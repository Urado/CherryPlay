using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Tests;

public sealed class CapturingOAuthLogProvider : ILoggerProvider
{
    private readonly ConcurrentQueue<string> _messages = new();

    public IReadOnlyCollection<string> Messages => _messages.ToArray();

    public ILogger CreateLogger(string categoryName) => new CapturingOAuthLogger(categoryName, _messages);

    public void Dispose()
    {
    }
}
