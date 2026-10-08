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

        _logger.LogInformation("[SignalR Server] <- Received UpdatePlaybackPosition");

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
            _logger.LogInformation(
                "[SignalR Server] -> Sending OnPlaybackPositionUpdated: organizerId={OrganizerId}, partyId={PartyId}",
                organizerId.Value,
                partyGuid);
            await Clients.Group(groupName).SendAsync("OnPlaybackPositionUpdated", partyId, trackId, position);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: invalid playback position");
            await SendErrorAsync(ex.Message);
        }
        catch (PartyNotFoundException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: party not found");
            await SendErrorAsync(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: invalid playback state");
            await SendErrorAsync(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError("[SignalR Server] Error in UpdatePlaybackPosition: failureType={FailureType}, failureLocation={FailureLocation}", ex.GetType().Name, CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(ex));
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

        _logger.LogInformation("[SignalR Server] <- Received UpdateFullState");

        if (!_partyIdValidator.TryParsePartyId(partyId, out var partyGuid))
        {
            await SendErrorAsync("Invalid party ID format");
            return;
        }

        if (state == null)
        {
            _logger.LogWarning("[SignalR Server] State is null");
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
            _logger.LogInformation(
                "[SignalR Server] -> Sending OnFullStateUpdated: organizerId={OrganizerId}, partyId={PartyId}",
                organizerId.Value,
                partyGuid);
            await Clients.Group(groupName).SendAsync("OnFullStateUpdated", partyId, state);
            await NotifyPartyDisplayStatusChangedAsync(partyGuid);
        }
        catch (PartyNotFoundException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: party not found");
            await SendErrorAsync(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError("[SignalR Server] Error in UpdateFullState: failureType={FailureType}, failureLocation={FailureLocation}", ex.GetType().Name, CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(ex));
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

        _logger.LogInformation("[SignalR Server] <- Received NotifyStateChanged");

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
            await Clients.Group(groupName).SendAsync("OnStateChanged", partyId);
            _logger.LogInformation(
                "[SignalR Server] -> Sending OnStateChanged: organizerId={OrganizerId}, partyId={PartyId}",
                organizerId.Value,
                partyGuid);
        }
        catch (Exception ex)
        {
            _logger.LogError("[SignalR Server] Error in NotifyStateChanged: failureType={FailureType}, failureLocation={FailureLocation}", ex.GetType().Name, CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(ex));
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
            _logger.LogInformation(
                "[SignalR Server] -> Sending OnPlaylistChanged: organizerId={OrganizerId}, partyId={PartyId}",
                organizerId.Value,
                partyGuid);
        }
        catch (Exception ex)
        {
            _logger.LogError("[SignalR Server] Error in NotifyPlaylistChanged: failureType={FailureType}, failureLocation={FailureLocation}", ex.GetType().Name, CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(ex));
            await SendErrorAsync("An error occurred while notifying playlist change");
        }
    }

    public async Task JoinPartyAsOrganizer(string partyId, string token)
    {
        var organizerId = await GetOrganizerIdFromContextAsync();
        if (!organizerId.HasValue && !string.IsNullOrWhiteSpace(token))
        {
            organizerId = await GetOrganizerIdFromTokenAsync(token);
        }

        if (!organizerId.HasValue)
        {
            _logger.LogWarning("[SignalR Server] JoinPartyAsOrganizer called without valid token");
            await SendErrorAsync("Authentication token is required");
            return;
        }

        _logger.LogInformation("[SignalR Server] <- Received JoinPartyAsOrganizer");

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
            _logger.LogInformation(
                "[SignalR Server] Added connection to group: organizerId={OrganizerId}, partyId={PartyId}",
                organizerId.Value,
                partyGuid);
        }
        catch (Exception ex)
        {
            _logger.LogError("[SignalR Server] Error in JoinPartyAsOrganizer: failureType={FailureType}, failureLocation={FailureLocation}", ex.GetType().Name, CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(ex));
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

        _logger.LogInformation("[SignalR Server] <- Received StartSession");

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
            _logger.LogInformation(
                "[SignalR Server] -> Sending OnSessionStarted: organizerId={OrganizerId}, partyId={PartyId}",
                organizerId.Value,
                partyGuid);
            await Clients.Group(groupName).SendAsync("OnSessionStarted", partyId);
            await NotifyPartyDisplayStatusChangedAsync(partyGuid);
        }
        catch (PartyNotFoundException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: party not found");
            await SendErrorAsync(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError("[SignalR Server] Error in StartSession: failureType={FailureType}, failureLocation={FailureLocation}", ex.GetType().Name, CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(ex));
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

        _logger.LogInformation("[SignalR Server] <- Received EndSession");

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
            _logger.LogInformation(
                "[SignalR Server] -> Sending OnSessionEnded: organizerId={OrganizerId}, partyId={PartyId}",
                organizerId.Value,
                partyGuid);
            await Clients.Group(groupName).SendAsync("OnSessionEnded", partyId);
            await NotifyPartyDisplayStatusChangedAsync(partyGuid);
        }
        catch (PartyNotFoundException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: party not found");
            await SendErrorAsync(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError("[SignalR Server] Error in EndSession: failureType={FailureType}, failureLocation={FailureLocation}", ex.GetType().Name, CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(ex));
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

        _logger.LogInformation("[SignalR Server] <- Received ResetPlaybackState");

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
                "[SignalR Server] -> Sending OnSessionEnded + PlaybackStateReset: organizerId={OrganizerId}, partyId={PartyId}",
                organizerId.Value,
                partyGuid);
            await Clients.Group(groupName).SendAsync("OnSessionEnded", partyId);
            await Clients.Group(groupName).SendAsync("PlaybackStateReset", partyId);
            await NotifyPartyDisplayStatusChangedAsync(partyGuid);
        }
        catch (PartyNotFoundException ex)
        {
            _logger.LogWarning("[SignalR Server] -> Sending Error: party not found");
            await SendErrorAsync(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError("[SignalR Server] Error in ResetPlaybackState: failureType={FailureType}, failureLocation={FailureLocation}", ex.GetType().Name, CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(ex));
            await SendErrorAsync("An error occurred while resetting playback state");
        }
    }
}
