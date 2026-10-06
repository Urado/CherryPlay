using Microsoft.AspNetCore.SignalR;
using CherryPlayServer.Models;

namespace CherryPlayServer.Hubs;

public partial class PartyHub
{
    public async Task JoinPartyAsViewer(string shortCode)
    {
        if (string.IsNullOrWhiteSpace(shortCode))
        {
            await SendErrorAsync("Short code cannot be empty");
            return;
        }

        _logger.LogInformation("[SignalR Server] <- Received JoinPartyAsViewer");

        try
        {
            var partyState = await _streamingService.GetPartyStateAsync(shortCode);
            if (partyState == null)
            {
                _logger.LogWarning("[SignalR Server] -> Sending Error: Party not found");
                await SendErrorAsync("Party not found");
                return;
            }

            if (!_partyIdValidator.TryParsePartyId(partyState.PartyId, out _))
            {
                await SendErrorAsync("Invalid party ID format");
                return;
            }

            _logger.LogInformation("Viewer joined party: partyId={PartyId}", partyState.PartyId);

            await Groups.AddToGroupAsync(Context.ConnectionId, partyState.PartyId);

            if (partyState.PlaybackState != null)
            {
                _logger.LogInformation("[SignalR Server] -> Sending OnFullStateUpdated");
                await Clients.Caller.SendAsync("OnFullStateUpdated", partyState.PartyId, partyState.PlaybackState);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError("[SignalR Server] Error in JoinPartyAsViewer: failureType={FailureType}, failureLocation={FailureLocation}", ex.GetType().Name, CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(ex));
            await SendErrorAsync("An error occurred while joining the party");
        }
    }

    public async Task<PartyStateDto?> JoinPartyAsViewerWithState(string shortCode)
    {
        if (string.IsNullOrWhiteSpace(shortCode))
        {
            await SendErrorAsync("Short code cannot be empty");
            return null;
        }

        _logger.LogInformation("[SignalR Server] <- Received JoinPartyAsViewerWithState");

        try
        {
            var partyState = await _streamingService.GetPartyStateAsync(shortCode);
            if (partyState == null)
            {
                _logger.LogWarning("[SignalR Server] Party not found");
                await SendErrorAsync("Party not found");
                return null;
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, partyState.PartyId);

            _logger.LogInformation("Viewer joined party: partyId={PartyId}", partyState.PartyId);

            _logger.LogInformation("[SignalR Server] -> Returning PartyStateDto: hasState={HasState}",
                partyState.PlaybackState != null);
            return partyState;
        }
        catch (Exception ex)
        {
            _logger.LogError("[SignalR Server] Error in JoinPartyAsViewerWithState: failureType={FailureType}, failureLocation={FailureLocation}", ex.GetType().Name, CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(ex));
            await SendErrorAsync("An error occurred while joining the party");
            return null;
        }
    }

    public async Task<PartyStateDto?> RequestFullState(string shortCode)
    {
        if (string.IsNullOrWhiteSpace(shortCode))
        {
            await SendErrorAsync("Short code cannot be empty");
            return null;
        }

        _logger.LogInformation("[SignalR Server] <- Received RequestFullState");

        try
        {
            var partyState = await _streamingService.GetPartyStateAsync(shortCode);
            if (partyState == null)
            {
                _logger.LogWarning("[SignalR Server] Party not found");
                await SendErrorAsync("Party not found");
                return null;
            }

            _logger.LogInformation("Viewer requested party state: partyId={PartyId}", partyState.PartyId);

            _logger.LogInformation("[SignalR Server] -> Returning PartyStateDto: hasState={HasState}",
                partyState.PlaybackState != null);
            return partyState;
        }
        catch (Exception ex)
        {
            _logger.LogError("[SignalR Server] Error in RequestFullState: failureType={FailureType}, failureLocation={FailureLocation}", ex.GetType().Name, CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(ex));
            await SendErrorAsync("An error occurred while requesting party state");
            return null;
        }
    }
}
