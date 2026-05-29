using Microsoft.AspNetCore.SignalR;
using CherryPlayServer.Models;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Options;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Hubs;

public class PartyHub : Hub
{
    private readonly IStreamingService _streamingService;
    private readonly IPartyIdValidator _partyIdValidator;
    private readonly IJwtService _jwtService;
    private readonly IPartyAccessService _partyAccessService;
    private readonly IOrganizerConnectionTracker _organizerConnectionTracker;
    private readonly IPartyRepository _partyRepository;
    private readonly IStreamingRepository _streamingRepository;
    private readonly IPartyDisplayStatusService _partyDisplayStatusService;
    private readonly IHubContext<PartyHub> _hubContext;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly PartyDisplayStatusOptions _displayStatusOptions;
    private readonly ILogger<PartyHub> _logger;

    public PartyHub(
        IStreamingService streamingService,
        IPartyIdValidator partyIdValidator,
        IJwtService jwtService,
        IPartyAccessService partyAccessService,
        IOrganizerConnectionTracker organizerConnectionTracker,
        IPartyRepository partyRepository,
        IStreamingRepository streamingRepository,
        IPartyDisplayStatusService partyDisplayStatusService,
        IHubContext<PartyHub> hubContext,
        IServiceScopeFactory scopeFactory,
        IOptions<PartyDisplayStatusOptions> displayStatusOptions,
        ILogger<PartyHub> logger)
    {
        _streamingService = streamingService ?? throw new ArgumentNullException(nameof(streamingService));
        _partyIdValidator = partyIdValidator ?? throw new ArgumentNullException(nameof(partyIdValidator));
        _jwtService = jwtService ?? throw new ArgumentNullException(nameof(jwtService));
        _partyAccessService = partyAccessService ?? throw new ArgumentNullException(nameof(partyAccessService));
        _organizerConnectionTracker = organizerConnectionTracker ?? throw new ArgumentNullException(nameof(organizerConnectionTracker));
        _partyRepository = partyRepository ?? throw new ArgumentNullException(nameof(partyRepository));
        _streamingRepository = streamingRepository ?? throw new ArgumentNullException(nameof(streamingRepository));
        _partyDisplayStatusService = partyDisplayStatusService
            ?? throw new ArgumentNullException(nameof(partyDisplayStatusService));
        _hubContext = hubContext ?? throw new ArgumentNullException(nameof(hubContext));
        _scopeFactory = scopeFactory ?? throw new ArgumentNullException(nameof(scopeFactory));
        _displayStatusOptions = displayStatusOptions?.Value
            ?? throw new ArgumentNullException(nameof(displayStatusOptions));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var connectionId = Context.ConnectionId;
        var partyId = _organizerConnectionTracker.TryRemoveOrganizer(connectionId);
        if (partyId.HasValue)
        {
            var partyIdStr = partyId.Value.ToString();
            _logger.LogInformation(
                "[SignalR Server] Organizer disconnected: connectionId={ConnectionId}, partyId={PartyId}",
                connectionId, partyIdStr);
            try
            {
                await Clients.Group(partyIdStr).SendAsync("OnConnectionStatusChanged", partyIdStr, false);
                await NotifyPartyDisplayStatusChangedAsync(partyId.Value);
                ScheduleOrganizerOfflineStatusAfterGrace(partyId.Value);
                _logger.LogInformation(
                    "[SignalR Server] -> Organizer disconnect: OnConnectionStatusChanged(offline) + display status, partyId={PartyId}",
                    partyIdStr);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[SignalR Server] Failed to notify on organizer disconnect: partyId={PartyId}", partyIdStr);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    #region Helper Methods

    private async Task SendErrorAsync(string message)
    {
        await Clients.Caller.SendAsync("Error", message);
    }

    private async Task<Guid?> GetOrganizerIdFromContextAsync()
    {
        var httpContext = Context.GetHttpContext();
        if (httpContext == null)
        {
            return null;
        }

        var token = httpContext.Request.Query["access_token"].FirstOrDefault() ??
                   httpContext.ExtractTokenFromRequest();

        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var result = await _jwtService.ValidateTokenAsync(token);
        if (!result.IsValid || !result.OrganizerId.HasValue)
        {
            return null;
        }

        Context.Items["OrganizerId"] = result.OrganizerId.Value;
        Context.Items["OrganizerName"] = result.Name;

        return result.OrganizerId.Value;
    }

    private async Task<Guid?> RequireOrganizerAuthAsync()
    {
        var organizerId = await GetOrganizerIdFromContextAsync();
        if (!organizerId.HasValue)
        {
            await SendErrorAsync("Authentication required");
        }
        return organizerId;
    }

    private async Task<bool> EnsurePartyOwnershipAsync(Guid partyId, Guid organizerId)
    {
        try
        {
            await _partyAccessService.EnsurePartyOwnershipAsync(partyId, organizerId);
            return true;
        }
        catch (PartyNotFoundException)
        {
            await SendErrorAsync("Party not found");
            return false;
        }
        catch (ForbiddenException)
        {
            await SendErrorAsync("You do not have permission to access this party");
            return false;
        }
    }

    #endregion

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
                await Task.Delay(TimeSpan.FromSeconds(graceSeconds)).ConfigureAwait(false);

                await using var scope = _scopeFactory.CreateAsyncScope();
                var tracker = scope.ServiceProvider.GetRequiredService<IOrganizerConnectionTracker>();
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
