using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Mappings;
using CherryPlayServer.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace CherryPlayServer.Infrastructure;

public sealed class AdminPartySessionResetNotifier(
    IHubContext<PartyHub> hubContext,
    IPartyDisplayStatusService displayStatusService) : IPartySessionResetNotifier
{
    public async Task NotifySessionResetAsync(
        Guid partyId,
        CherryPlayServer.Core.Enums.PartyLifecycleState lifecycleState,
        CherryPlayServer.Core.Entities.PlaybackState state)
    {
        var group = partyId.ToString();
        var clients = hubContext.Clients.Group(group);
        await clients.SendAsync("OnSessionEnded", group);
        await clients.SendAsync("PlaybackStateReset", group);
        await clients.SendAsync("OnFullStateUpdated", group, state.ToDto());
        var displayStatus = displayStatusService.Compute(lifecycleState, state, partyId);
        await clients.SendAsync("OnPartyDisplayStatusChanged", group, displayStatus);
    }
}
