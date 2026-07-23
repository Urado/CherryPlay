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

        _logger.LogInformation("[SignalR Server] <- Received JoinPartyAsViewer: shortCode={ShortCode}, connectionId={ConnectionId}",
            shortCode, Context.ConnectionId);

        try
        {
            var partyState = await _streamingService.GetPartyStateAsync(shortCode);
            if (partyState == null)
            {
                _logger.LogWarning("[SignalR Server] -> Sending Error: Party not found for shortCode={ShortCode}", shortCode);
                await SendErrorAsync("Party not found");
                return;
            }

            if (!_partyIdValidator.TryParsePartyId(partyState.PartyId, out _))
            {
                await SendErrorAsync("Invalid party ID format");
                return;
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, partyState.PartyId);

            if (partyState.PlaybackState != null)
            {
                _logger.LogInformation("[SignalR Server] -> Sending OnFullStateUpdated: partyId={PartyId}, connectionId={ConnectionId}",
                    partyState.PartyId, Context.ConnectionId);
                await Clients.Caller.SendAsync("OnFullStateUpdated", partyState.PartyId, partyState.PlaybackState);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SignalR Server] Error in JoinPartyAsViewer: shortCode={ShortCode}", shortCode);
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

        _logger.LogInformation("[SignalR Server] <- Received JoinPartyAsViewerWithState: shortCode={ShortCode}, connectionId={ConnectionId}",
            shortCode, Context.ConnectionId);

        try
        {
            var partyState = await _streamingService.GetPartyStateAsync(shortCode);
            if (partyState == null)
            {
                _logger.LogWarning("[SignalR Server] Party not found for shortCode={ShortCode}", shortCode);
                await SendErrorAsync("Party not found");
                return null;
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, partyState.PartyId);

            _logger.LogInformation("[SignalR Server] -> Returning PartyStateDto: partyId={PartyId}, hasState={HasState}",
                partyState.PartyId, partyState.PlaybackState != null);
            return partyState;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SignalR Server] Error in JoinPartyAsViewerWithState: shortCode={ShortCode}", shortCode);
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

        _logger.LogInformation("[SignalR Server] <- Received RequestFullState: shortCode={ShortCode}, connectionId={ConnectionId}",
            shortCode, Context.ConnectionId);

        try
        {
            var partyState = await _streamingService.GetPartyStateAsync(shortCode);
            if (partyState == null)
            {
                _logger.LogWarning("[SignalR Server] Party not found for shortCode={ShortCode}", shortCode);
                await SendErrorAsync("Party not found");
                return null;
            }

            _logger.LogInformation("[SignalR Server] -> Returning PartyStateDto: partyId={PartyId}, hasState={HasState}",
                partyState.PartyId, partyState.PlaybackState != null);
            return partyState;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SignalR Server] Error in RequestFullState: shortCode={ShortCode}", shortCode);
            await SendErrorAsync("An error occurred while requesting party state");
            return null;
        }
    }
}
