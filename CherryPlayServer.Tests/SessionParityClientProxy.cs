using Microsoft.AspNetCore.SignalR;

namespace CherryPlayServer.Tests;

public sealed class SessionParityClientProxy : IClientProxy
{
    public List<(string Method, object?[] Arguments)> Messages { get; } = [];

    public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default)
    {
        Messages.Add((method, args));
        return Task.CompletedTask;
    }
}
