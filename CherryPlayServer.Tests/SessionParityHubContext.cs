using CherryPlayServer.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace CherryPlayServer.Tests;

public sealed class SessionParityHubContext(SessionParityHubClients clients, SessionParityGroupManager groups) : IHubContext<PartyHub>
{
    public IHubClients Clients => clients;
    public IGroupManager Groups => groups;
}
