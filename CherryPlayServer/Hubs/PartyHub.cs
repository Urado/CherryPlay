using Microsoft.AspNetCore.SignalR;
using CherryPlayServer.Models;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Hubs;

public class PartyHub : Hub
{
    private readonly IStreamingService _streamingService;
    private readonly IPartyIdValidator _partyIdValidator;
    private readonly IJwtService _jwtService;
    private readonly IPartyRepository _partyRepository;
    private readonly ILogger<PartyHub> _logger;

    public PartyHub(
        IStreamingService streamingService,
        IPartyIdValidator partyIdValidator,
        IJwtService jwtService,
        IPartyRepository partyRepository,
        ILogger<PartyHub> logger)
    {
        _streamingService = streamingService ?? throw new ArgumentNullException(nameof(streamingService));
        _partyIdValidator = partyIdValidator ?? throw new ArgumentNullException(nameof(partyIdValidator));
        _jwtService = jwtService ?? throw new ArgumentNullException(nameof(jwtService));
        _partyRepository = partyRepository ?? throw new ArgumentNullException(nameof(partyRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    #region Helper Methods

    private async Task SendErrorAsync(string message)
    {
        await Clients.Caller.SendAsync("Error", message);
    }

    /// <summary>
    /// Унифицированный метод для проверки авторизации организатора.
    /// Извлекает токен из различных источников и валидирует его.
    /// </summary>
    private async Task<Guid?> GetOrganizerIdFromContextAsync()
    {
        var httpContext = Context.GetHttpContext();
        if (httpContext == null)
        {
            return null;
        }

        // Получаем токен из заголовка Authorization, query string (для WebSocket) или cookie
        // Приоритет: Authorization header > query string > cookie
        // WebSocket в браузере не может устанавливать кастомные заголовки,
        // поэтому SignalR использует query string для передачи токена
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

        // Sync context items to SignalR context
        Context.Items["OrganizerId"] = result.OrganizerId.Value;
        Context.Items["OrganizerName"] = result.Name;

        return result.OrganizerId.Value;
    }

    /// <summary>
    /// Проверяет авторизацию организатора и возвращает его ID или null.
    /// </summary>
    private async Task<Guid?> RequireOrganizerAuthAsync()
    {
        var organizerId = await GetOrganizerIdFromContextAsync();
        if (!organizerId.HasValue)
        {
            await SendErrorAsync("Authentication required");
        }
        return organizerId;
    }

    /// <summary>
    /// Проверяет, что вечеринка принадлежит указанному организатору.
    /// </summary>
    private async Task<bool> EnsurePartyOwnershipAsync(Guid partyId, Guid organizerId)
    {
        var party = await _partyRepository.GetByIdAsync(partyId);
        if (party == null)
        {
            await SendErrorAsync("Party not found");
            return false;
        }

        if (party.OrganizerId != organizerId)
        {
            _logger.LogWarning(
                "[SignalR Server] Access denied: party {PartyId} does not belong to organizer {OrganizerId}",
                partyId, organizerId);
            await SendErrorAsync("You do not have permission to access this party");
            return false;
        }

        return true;
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

        // Проверяем владение вечеринкой
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

        // Проверяем владение вечеринкой
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

        // Проверяем владение вечеринкой
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

    /// <summary>
    /// Уведомляет всех зрителей об изменении плейлиста (вызывается из контроллера через IHubContext)
    /// </summary>
    public async Task NotifyPlaylistChanged(string partyId)
    {
        _logger.LogInformation("[SignalR Server] <- Received NotifyPlaylistChanged: partyId={PartyId}, connectionId={ConnectionId}",
            partyId, Context.ConnectionId);

        if (!_partyIdValidator.TryParsePartyId(partyId, out var partyGuid))
        {
            await SendErrorAsync("Invalid party ID format");
            return;
        }

        try
        {
            var groupName = partyGuid.ToString();
            _logger.LogInformation("[SignalR Server] -> Sending OnPlaylistChanged: partyId={PartyId}, group={Group}",
                partyId, groupName);
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
            // Попытка валидации через переданный токен
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

        // Проверяем владение вечеринкой
        if (!await EnsurePartyOwnershipAsync(partyGuid, organizerId.Value))
        {
            return;
        }

        try
        {
            var groupName = partyGuid.ToString();
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
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

        // Проверяем владение вечеринкой
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

        // Проверяем владение вечеринкой
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
}
