using Microsoft.AspNetCore.SignalR;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Hubs;

namespace CherryPlayServer.Infrastructure;

public class PartyHubPlaylistNotifier : IPartyPlaylistNotifier
{
    private readonly IHubContext<PartyHub> _hubContext;
    private readonly ILogger<PartyHubPlaylistNotifier> _logger;

    public PartyHubPlaylistNotifier(IHubContext<PartyHub> hubContext, ILogger<PartyHubPlaylistNotifier> logger)
    {
        _hubContext = hubContext ?? throw new ArgumentNullException(nameof(hubContext));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task NotifyPlaylistChangedAsync(Guid partyId)
    {
        var partyIdStr = partyId.ToString();
        _logger.LogDebug("Sending OnPlaylistChanged: partyId={PartyId}, group={Group}", partyIdStr, partyIdStr);
        await _hubContext.Clients.Group(partyIdStr).SendAsync("OnPlaylistChanged", partyIdStr);
    }
}
