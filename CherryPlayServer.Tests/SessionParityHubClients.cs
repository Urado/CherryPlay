using Microsoft.AspNetCore.SignalR;

namespace CherryPlayServer.Tests;

public sealed class SessionParityHubClients : IHubCallerClients, IHubClients
{
    public SessionParityClientProxy CallerProxy { get; } = new();
    public SessionParityClientProxy GroupProxy { get; } = new();
    public IClientProxy Caller => CallerProxy;
    public IClientProxy Others => throw new NotSupportedException();
    public IClientProxy All => throw new NotSupportedException();
    public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => throw new NotSupportedException();
    public IClientProxy Client(string connectionId) => throw new NotSupportedException();
    public IClientProxy Clients(IReadOnlyList<string> connectionIds) => throw new NotSupportedException();
    public IClientProxy Group(string groupName) => GroupProxy;
    public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => throw new NotSupportedException();
    public IClientProxy Groups(IReadOnlyList<string> groupNames) => throw new NotSupportedException();
    public IClientProxy OthersInGroup(string groupName) => throw new NotSupportedException();
    public IClientProxy User(string userId) => throw new NotSupportedException();
    public IClientProxy Users(IReadOnlyList<string> userIds) => throw new NotSupportedException();
}
