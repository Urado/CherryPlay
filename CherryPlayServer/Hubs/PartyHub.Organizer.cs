using Microsoft.AspNetCore.SignalR;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Models;

namespace CherryPlayServer.Hubs;

public partial class PartyHub
{
    public async Task UpdatePlaybackPosition(string partyId, string trackId, double position)
    {
        var organizerId = await RequireOrganizerAuthAsync();
        if (!organizerId.HasValue)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(trackId))
        {
            await SendErrorAsync("Track ID cannot be empty");
            return;
        }

        if (position < 0)
        {
            await SendErrorAsync("Position cannot be negative");
            return;
        }

        _logger.LogInformation("[SignalR Server] <- Received UpdatePlaybackPosition: partyId={PartyId}, trackId={TrackId}, position={Position}, connectionId={ConnectionId}",
            partyId, trackId, position, Context.ConnectionId);

        if (!_partyIdValidator.TryParsePartyId(partyId, out var partyGuid))
        {
            await SendErrorAsync("Invalid party ID format");
            return;
        }

        if (!await EnsurePartyOwnershipAsync(partyGuid, organizerId.Value))
        {
            return;
        }

        try
        {
            await _streamingService.UpdatePlaybackPositionAsync(partyGuid, trackId, position);

            var groupName = partyGuid.ToString();
            _logger.LogInformation("[SignalR Server] -> Sending OnPlaybackPositionUpdated: partyId={PartyId}, trackId={TrackId}, position={Position}, group={Group}",
                partyId, trackId, position, groupName);
            await Clients.Group(groupName).SendAsync("OnPlaybackPositionUpdated", partyId, trackId, position);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: {Message}, partyId={PartyId}", ex.Message, partyId);
            await SendErrorAsync(ex.Message);
        }
        catch (PartyNotFoundException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: {Message}, partyId={PartyId}", ex.Message, partyId);
            await SendErrorAsync(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: {Message}, partyId={PartyId}", ex.Message, partyId);
            await SendErrorAsync(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SignalR Server] Error in UpdatePlaybackPosition: partyId={PartyId}", partyId);
            await SendErrorAsync("An error occurred while updating playback position");
        }
    }

    public async Task UpdateFullState(string partyId, PlaybackStateDto? state)
    {
        var organizerId = await RequireOrganizerAuthAsync();
        if (!organizerId.HasValue)
        {
            return;
        }

        _logger.LogInformation("[SignalR Server] <- Received UpdateFullState: partyId={PartyId}, currentTrackId={CurrentTrackId}, status={Status}, position={Position}, connectionId={ConnectionId}",
            partyId, state?.CurrentTrackId, state?.Status, state?.Position, Context.ConnectionId);

        if (!_partyIdValidator.TryParsePartyId(partyId, out var partyGuid))
        {
            await SendErrorAsync("Invalid party ID format");
            return;
        }

        if (state == null)
        {
            _logger.LogWarning("[SignalR Server] State is null for partyId={PartyId}", partyId);
            await SendErrorAsync("State cannot be null");
            return;
        }

        if (!await EnsurePartyOwnershipAsync(partyGuid, organizerId.Value))
        {
            return;
        }

        try
        {
            await _streamingService.UpdateFullStateAsync(partyGuid, state);

            var groupName = partyGuid.ToString();
            _logger.LogInformation("[SignalR Server] -> Sending OnFullStateUpdated: partyId={PartyId}, currentTrackId={CurrentTrackId}, status={Status}, position={Position}, group={Group}",
                partyId, state.CurrentTrackId, state.Status, state.Position, groupName);
            await Clients.Group(groupName).SendAsync("OnFullStateUpdated", partyId, state);
            await NotifyPartyDisplayStatusChangedAsync(partyGuid);
        }
        catch (PartyNotFoundException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: {Message}, partyId={PartyId}", ex.Message, partyId);
            await SendErrorAsync(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SignalR Server] Error in UpdateFullState: partyId={PartyId}", partyId);
            await SendErrorAsync("An error occurred while updating full state");
        }
    }

    public async Task NotifyStateChanged(string partyId)
    {
        var organizerId = await RequireOrganizerAuthAsync();
        if (!organizerId.HasValue)
        {
            return;
        }

        _logger.LogInformation("[SignalR Server] <- Received NotifyStateChanged: partyId={PartyId}, connectionId={ConnectionId}",
            partyId, Context.ConnectionId);

        if (!_partyIdValidator.TryParsePartyId(partyId, out var partyGuid))
        {
            await SendErrorAsync("Invalid party ID format");
            return;
        }

        if (!await EnsurePartyOwnershipAsync(partyGuid, organizerId.Value))
        {
            return;
        }

        try
        {
            var groupName = partyGuid.ToString();
            _logger.LogInformation("[SignalR Server] -> Sending OnStateChanged: partyId={PartyId}, group={Group}",
                partyId, groupName);
            await Clients.Group(groupName).SendAsync("OnStateChanged", partyId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SignalR Server] Error in NotifyStateChanged: partyId={PartyId}", partyId);
            await SendErrorAsync("An error occurred while notifying state change");
        }
    }

    public async Task NotifyPlaylistChanged(string partyId)
    {
        var organizerId = await RequireOrganizerAuthAsync();
        if (!organizerId.HasValue)
        {
            return;
        }

        if (!_partyIdValidator.TryParsePartyId(partyId, out var partyGuid))
        {
            await SendErrorAsync("Invalid party ID format");
            return;
        }

        if (!await EnsurePartyOwnershipAsync(partyGuid, organizerId.Value))
        {
            return;
        }

        try
        {
            var groupName = partyGuid.ToString();
            await Clients.Group(groupName).SendAsync("OnPlaylistChanged", partyId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SignalR Server] Error in NotifyPlaylistChanged: partyId={PartyId}", partyId);
            await SendErrorAsync("An error occurred while notifying playlist change");
        }
    }

    public async Task JoinPartyAsOrganizer(string partyId, string token)
    {
        var organizerId = await GetOrganizerIdFromContextAsync();
        if (!organizerId.HasValue && !string.IsNullOrWhiteSpace(token))
        {
            var result = await _jwtService.ValidateTokenAsync(token);
            if (result.IsValid && result.OrganizerId.HasValue)
            {
                organizerId = result.OrganizerId.Value;
                Context.Items["OrganizerId"] = organizerId.Value;
                Context.Items["OrganizerName"] = result.Name;
            }
        }

        if (!organizerId.HasValue)
        {
            _logger.LogWarning("[SignalR Server] JoinPartyAsOrganizer called without valid token: partyId={PartyId}, connectionId={ConnectionId}",
                partyId, Context.ConnectionId);
            await SendErrorAsync("Authentication token is required");
            return;
        }

        _logger.LogInformation("[SignalR Server] <- Received JoinPartyAsOrganizer: partyId={PartyId}, connectionId={ConnectionId}",
            partyId, Context.ConnectionId);

        if (!_partyIdValidator.TryParsePartyId(partyId, out var partyGuid))
        {
            await SendErrorAsync("Invalid party ID format");
            return;
        }

        if (!await EnsurePartyOwnershipAsync(partyGuid, organizerId.Value))
        {
            return;
        }

        try
        {
            var groupName = partyGuid.ToString();
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            _organizerConnectionTracker.RegisterOrganizer(Context.ConnectionId, partyGuid);
            await Clients.Group(groupName).SendAsync("OnConnectionStatusChanged", partyId, true);
            await NotifyPartyDisplayStatusChangedAsync(partyGuid);
            _logger.LogInformation("[SignalR Server] Added connection to group: partyId={PartyId}, group={Group}, connectionId={ConnectionId}",
                partyId, groupName, Context.ConnectionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SignalR Server] Error in JoinPartyAsOrganizer: partyId={PartyId}", partyId);
            await SendErrorAsync("An error occurred while joining as organizer");
        }
    }

    public async Task StartSession(string partyId)
    {
        var organizerId = await RequireOrganizerAuthAsync();
        if (!organizerId.HasValue)
        {
            return;
        }

        _logger.LogInformation("[SignalR Server] <- Received StartSession: partyId={PartyId}, connectionId={ConnectionId}",
            partyId, Context.ConnectionId);

        if (!_partyIdValidator.TryParsePartyId(partyId, out var partyGuid))
        {
            await SendErrorAsync("Invalid party ID format");
            return;
        }

        if (!await EnsurePartyOwnershipAsync(partyGuid, organizerId.Value))
        {
            return;
        }

        try
        {
            await _streamingService.StartSessionAsync(partyGuid);

            var groupName = partyGuid.ToString();
            _logger.LogInformation("[SignalR Server] -> Sending OnSessionStarted: partyId={PartyId}, group={Group}",
                partyId, groupName);
            await Clients.Group(groupName).SendAsync("OnSessionStarted", partyId);
            await NotifyPartyDisplayStatusChangedAsync(partyGuid);
        }
        catch (PartyNotFoundException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: {Message}, partyId={PartyId}", ex.Message, partyId);
            await SendErrorAsync(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SignalR Server] Error in StartSession: partyId={PartyId}", partyId);
            await SendErrorAsync("An error occurred while starting session");
        }
    }

    public async Task EndSession(string partyId)
    {
        var organizerId = await RequireOrganizerAuthAsync();
        if (!organizerId.HasValue)
        {
            return;
        }

        _logger.LogInformation("[SignalR Server] <- Received EndSession: partyId={PartyId}, connectionId={ConnectionId}",
            partyId, Context.ConnectionId);

        if (!_partyIdValidator.TryParsePartyId(partyId, out var partyGuid))
        {
            await SendErrorAsync("Invalid party ID format");
            return;
        }

        if (!await EnsurePartyOwnershipAsync(partyGuid, organizerId.Value))
        {
            return;
        }

        try
        {
            await _streamingService.EndSessionAsync(partyGuid);

            var groupName = partyGuid.ToString();
            _logger.LogInformation("[SignalR Server] -> Sending OnSessionEnded: partyId={PartyId}, group={Group}",
                partyId, groupName);
            await Clients.Group(groupName).SendAsync("OnSessionEnded", partyId);
            await NotifyPartyDisplayStatusChangedAsync(partyGuid);
        }
        catch (PartyNotFoundException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: {Message}, partyId={PartyId}", ex.Message, partyId);
            await SendErrorAsync(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SignalR Server] Error in EndSession: partyId={PartyId}", partyId);
            await SendErrorAsync("An error occurred while ending session");
        }
    }

    public async Task ResetPlaybackState(string partyId)
    {
        var organizerId = await RequireOrganizerAuthAsync();
        if (!organizerId.HasValue)
        {
            return;
        }

        _logger.LogInformation(
            "[SignalR Server] <- Received ResetPlaybackState: partyId={PartyId}, connectionId={ConnectionId}",
            partyId, Context.ConnectionId);

        if (!_partyIdValidator.TryParsePartyId(partyId, out var partyGuid))
        {
            await SendErrorAsync("Invalid party ID format");
            return;
        }

        if (!await EnsurePartyOwnershipAsync(partyGuid, organizerId.Value))
        {
            return;
        }

        try
        {
            await _streamingService.ResetPlaybackStateAsync(partyGuid);

            var groupName = partyGuid.ToString();
            _logger.LogInformation(
                "[SignalR Server] -> Sending OnSessionEnded + PlaybackStateReset: partyId={PartyId}, group={Group}",
                partyId, groupName);
            await Clients.Group(groupName).SendAsync("OnSessionEnded", partyId);
            await Clients.Group(groupName).SendAsync("PlaybackStateReset", partyId);
            await NotifyPartyDisplayStatusChangedAsync(partyGuid);
        }
        catch (PartyNotFoundException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: {Message}, partyId={PartyId}", ex.Message, partyId);
            await SendErrorAsync(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SignalR Server] Error in ResetPlaybackState: partyId={PartyId}", partyId);
            await SendErrorAsync("An error occurred while resetting playback state");
        }
    }
}
