using CherryPlayServer.Hubs;
using CherryPlayServer.Infrastructure;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

[TestFixture]
public class PartyHubPlaylistNotifierTests
{
    private static readonly Guid PartyId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    [Test]
    public async Task NotifyPlaylistChangedAsync_UsesPartyIdAsGroupName()
    {
        var hubContext = new CapturingHubContext();
        var notifier = new PartyHubPlaylistNotifier(hubContext, NullLogger<PartyHubPlaylistNotifier>.Instance);

        await notifier.NotifyPlaylistChangedAsync(PartyId);

        Assert.That(hubContext.LastRequestedGroupName, Is.EqualTo(PartyId.ToString()));
    }

    [Test]
    public async Task NotifyPlaylistChangedAsync_SendsOnPlaylistChanged_WithPartyIdString()
    {
        var hubContext = new CapturingHubContext();
        var notifier = new PartyHubPlaylistNotifier(hubContext, NullLogger<PartyHubPlaylistNotifier>.Instance);
        var partyIdStr = PartyId.ToString();

        await notifier.NotifyPlaylistChangedAsync(PartyId);

        Assert.That(hubContext.GroupProxy.Messages, Has.Count.EqualTo(1));
        var (method, args) = hubContext.GroupProxy.Messages[0];
        Assert.That(method, Is.EqualTo("OnPlaylistChanged"));
        Assert.That(args, Has.Length.EqualTo(1));
        Assert.That(args[0], Is.EqualTo(partyIdStr));
    }

    private sealed class CapturingHubContext : IHubContext<PartyHub>
    {
        public CapturingClientProxy GroupProxy { get; } = new();
        public CapturingHubClients HubClients { get; } = new();
        public IHubClients Clients => HubClients;
        public string? LastRequestedGroupName => HubClients.LastGroupName;
        public IGroupManager Groups => throw new NotSupportedException();

        public CapturingHubContext()
        {
            HubClients.GroupProxy = GroupProxy;
        }
    }

    private sealed class CapturingHubClients : IHubClients
    {
        public CapturingClientProxy GroupProxy { get; set; } = new();
        public string? LastGroupName { get; private set; }

        public IClientProxy All => throw new NotSupportedException();
        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => throw new NotSupportedException();
        public IClientProxy Client(string connectionId) => throw new NotSupportedException();
        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => throw new NotSupportedException();

        public IClientProxy Group(string groupName)
        {
            LastGroupName = groupName;
            return GroupProxy;
        }

        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) =>
            throw new NotSupportedException();
        public IClientProxy Groups(IReadOnlyList<string> groupNames) => throw new NotSupportedException();
        public IClientProxy User(string userId) => throw new NotSupportedException();
        public IClientProxy Users(IReadOnlyList<string> userIds) => throw new NotSupportedException();
    }

    private sealed class CapturingClientProxy : IClientProxy
    {
        public List<(string Method, object?[] Args)> Messages { get; } = [];

        public Task SendCoreAsync(string methodName, object?[] args, CancellationToken cancellationToken = default)
        {
            Messages.Add((methodName, args));
            return Task.CompletedTask;
        }
    }
}
