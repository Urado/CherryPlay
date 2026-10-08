using Microsoft.AspNetCore.SignalR;

namespace CherryPlayServer.Tests;

public sealed class SessionParityGroupManager : IGroupManager
{
    public int AddCount { get; private set; }

    public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
    {
        AddCount++;
        return Task.CompletedTask;
    }

    public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) => Task.CompletedTask;
}
