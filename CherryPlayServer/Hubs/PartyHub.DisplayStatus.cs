using Microsoft.AspNetCore.SignalR;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Hubs;

public partial class PartyHub
{
    private async Task NotifyPartyDisplayStatusChangedAsync(Guid partyId)
    {
        var party = await _partyRepository.GetByIdAsync(partyId);
        if (party == null)
        {
            return;
        }

        var sessionState = await _streamingRepository.GetSessionStateAsync(partyId);
        var displayStatus = _partyDisplayStatusService.Compute(
            party.PartyLifecycleState,
            sessionState,
            partyId);
        var partyIdStr = partyId.ToString();
        await _hubContext.Clients.Group(partyIdStr).SendAsync("OnPartyDisplayStatusChanged", partyIdStr, displayStatus);
    }

    private void ScheduleOrganizerOfflineStatusAfterGrace(Guid partyId)
    {
        var graceSeconds = _displayStatusOptions.OrganizerOfflineGraceSeconds;
        if (graceSeconds <= 0)
        {
            return;
        }

        _ = Task.Run(async () =>
        {
            try
            {
                var gracePeriod = TimeSpan.FromSeconds(graceSeconds);

                await using var scope = _scopeFactory.CreateAsyncScope();
                var tracker = scope.ServiceProvider.GetRequiredService<IOrganizerConnectionTracker>();

                while (!tracker.IsOrganizerConnected(partyId)
                    && tracker.TryGetOrganizerDisconnectedAt(partyId, out var disconnectedAt))
                {
                    var remaining = gracePeriod - (DateTime.UtcNow - disconnectedAt);
                    if (remaining <= TimeSpan.Zero)
                    {
                        break;
                    }

                    await Task.Delay(remaining).ConfigureAwait(false);
                }

                if (tracker.IsOrganizerConnected(partyId))
                {
                    return;
                }

                var partyRepository = scope.ServiceProvider.GetRequiredService<IPartyRepository>();
                var streamingRepository = scope.ServiceProvider.GetRequiredService<IStreamingRepository>();
                var displayStatusService = scope.ServiceProvider.GetRequiredService<IPartyDisplayStatusService>();

                var party = await partyRepository.GetByIdAsync(partyId).ConfigureAwait(false);
                if (party == null)
                {
                    return;
                }

                var sessionState = await streamingRepository.GetSessionStateAsync(partyId).ConfigureAwait(false);
                var displayStatus = displayStatusService.Compute(
                    party.PartyLifecycleState,
                    sessionState,
                    partyId);
                var partyIdStr = partyId.ToString();
                await _hubContext.Clients.Group(partyIdStr)
                    .SendAsync("OnPartyDisplayStatusChanged", partyIdStr, displayStatus)
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "[SignalR Server] Failed grace-expiry display status notify: partyId={PartyId}",
                    partyId);
            }
        });
    }
}
