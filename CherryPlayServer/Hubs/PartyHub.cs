using Microsoft.AspNetCore.SignalR;
using CherryPlayServer.Models;
using CherryPlayServer.Data;
using System;

namespace CherryPlayServer.Hubs;

public class PartyHub : Hub
{
    private readonly InMemoryPartyStore _partyStore;
    private readonly ILogger<PartyHub> _logger;

    public PartyHub(InMemoryPartyStore partyStore, ILogger<PartyHub> logger)
    {
        _partyStore = partyStore;
        _logger = logger;
    }

    public async Task JoinPartyAsViewer(string shortCode)
    {
        _logger.LogInformation("[SignalR Server] ← Received JoinPartyAsViewer: shortCode={ShortCode}, connectionId={ConnectionId}", 
            shortCode, Context.ConnectionId);
        
        var party = _partyStore.GetPartyByShortCode(shortCode);
        if (party == null)
        {
            _logger.LogWarning("[SignalR Server] → Sending Error: Party not found for shortCode={ShortCode}", shortCode);
            await Clients.Caller.SendAsync("Error", "Party not found");
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, party.Id.ToString());
        
        var state = _partyStore.GetSessionState(party.Id);
        if (state != null)
        {
            _logger.LogInformation("[SignalR Server] → Sending OnFullStateUpdated: partyId={PartyId}, connectionId={ConnectionId}", 
                party.Id, Context.ConnectionId);
            await Clients.Caller.SendAsync("OnFullStateUpdated", party.Id.ToString(), state);
        }
    }

    public Task<PartyStateDto?> JoinPartyAsViewerWithState(string shortCode)
    {
        _logger.LogInformation("[SignalR Server] ← Received JoinPartyAsViewerWithState: shortCode={ShortCode}, connectionId={ConnectionId}", 
            shortCode, Context.ConnectionId);
        
        var party = _partyStore.GetPartyByShortCode(shortCode);
        if (party == null)
        {
            _logger.LogWarning("[SignalR Server] Party not found for shortCode={ShortCode}", shortCode);
            return Task.FromResult<PartyStateDto?>(null);
        }

        Groups.AddToGroupAsync(Context.ConnectionId, party.Id.ToString());
        
        var state = _partyStore.GetSessionState(party.Id);
        _logger.LogInformation("[SignalR Server] → Returning PartyStateDto: partyId={PartyId}, hasState={HasState}", 
            party.Id, state != null);
        return Task.FromResult<PartyStateDto?>(new PartyStateDto
        {
            PartyId = party.Id.ToString(),
            IsSessionActive = state != null,
            PlaybackState = state,
            Playlist = party.Playlist
        });
    }

    public Task<PartyStateDto> RequestFullState(string shortCode)
    {
        _logger.LogInformation("[SignalR Server] ← Received RequestFullState: shortCode={ShortCode}, connectionId={ConnectionId}", 
            shortCode, Context.ConnectionId);
        
        var party = _partyStore.GetPartyByShortCode(shortCode);
        if (party == null)
        {
            _logger.LogError("[SignalR Server] Party not found for shortCode={ShortCode}", shortCode);
            throw new Exception("Party not found");
        }

        var state = _partyStore.GetSessionState(party.Id);
        _logger.LogInformation("[SignalR Server] → Returning PartyStateDto: partyId={PartyId}, hasState={HasState}", 
            party.Id, state != null);
        return Task.FromResult(new PartyStateDto
        {
            PartyId = party.Id.ToString(),
            IsSessionActive = state != null,
            PlaybackState = state,
            Playlist = party.Playlist
        });
    }

    public async Task UpdatePlaybackPosition(string partyId, string trackId, double position)
    {
        _logger.LogInformation("[SignalR Server] ← Received UpdatePlaybackPosition: partyId={PartyId}, trackId={TrackId}, position={Position}, connectionId={ConnectionId}", 
            partyId, trackId, position, Context.ConnectionId);
        
        if (!Guid.TryParse(partyId, out var partyGuid))
        {
            _logger.LogWarning("[SignalR Server] Invalid partyId format: {PartyId}", partyId);
            return;
        }

        var party = _partyStore.GetPartyById(partyGuid);
        var state = _partyStore.GetSessionState(partyGuid);
        
        if (state != null)
        {
            state.Position = position;
            state.CurrentTrackId = trackId;
            state.LastUpdatedAt = DateTime.UtcNow;
            
            // Получаем duration из плейлиста, если он доступен
            if (party != null && party.Playlist != null)
            {
                var trackDuration = FindTrackDuration(party.Playlist.Items, trackId);
                if (trackDuration.HasValue && trackDuration.Value > 0)
                {
                    state.Duration = trackDuration.Value;
                }
            }
            
            _partyStore.SetSessionState(partyGuid, state);
        }

        var groupName = partyGuid.ToString();
        _logger.LogInformation("[SignalR Server] → Sending OnPlaybackPositionUpdated: partyId={PartyId}, trackId={TrackId}, position={Position}, group={Group}", 
            partyId, trackId, position, groupName);
        await Clients.Group(groupName).SendAsync("OnPlaybackPositionUpdated", partyId, trackId, position);
    }

    private double? FindTrackDuration(List<PlayerItem> items, string trackId)
    {
        foreach (var item in items)
        {
            if (item.Type == "track" && item.Id == trackId)
            {
                return item.Duration.HasValue ? (double)item.Duration.Value : null;
            }
            if (item.Type == "group" && item.Items != null)
            {
                var duration = FindTrackDuration(item.Items, trackId);
                if (duration.HasValue)
                {
                    return duration;
                }
            }
        }
        return null;
    }

    public async Task UpdateFullState(string partyId, PlaybackStateDto state)
    {
        _logger.LogInformation("[SignalR Server] ← Received UpdateFullState: partyId={PartyId}, currentTrackId={CurrentTrackId}, status={Status}, position={Position}, connectionId={ConnectionId}", 
            partyId, state?.CurrentTrackId, state?.Status, state?.Position, Context.ConnectionId);
        
        if (!Guid.TryParse(partyId, out var partyGuid))
        {
            _logger.LogWarning("[SignalR Server] Invalid partyId format: {PartyId}", partyId);
            return;
        }

        // Если duration равен 0 или не установлен, пытаемся получить из плейлиста
        var party = _partyStore.GetPartyById(partyGuid);
        if (party != null && party.Playlist != null && 
            state.Duration == 0 && 
            !string.IsNullOrEmpty(state.CurrentTrackId))
        {
            var trackDuration = FindTrackDuration(party.Playlist.Items, state.CurrentTrackId);
            if (trackDuration.HasValue && trackDuration.Value > 0)
            {
                state.Duration = trackDuration.Value;
            }
        }

        state.LastUpdatedAt = DateTime.UtcNow;
        _partyStore.SetSessionState(partyGuid, state);
        
        var groupName = partyGuid.ToString();
        _logger.LogInformation("[SignalR Server] → Sending OnFullStateUpdated: partyId={PartyId}, currentTrackId={CurrentTrackId}, status={Status}, position={Position}, group={Group}", 
            partyId, state?.CurrentTrackId, state?.Status, state?.Position, groupName);
        await Clients.Group(groupName).SendAsync("OnFullStateUpdated", partyId, state);
    }

    public async Task NotifyStateChanged(string partyId)
    {
        _logger.LogInformation("[SignalR Server] ← Received NotifyStateChanged: partyId={PartyId}, connectionId={ConnectionId}", 
            partyId, Context.ConnectionId);
        
        if (Guid.TryParse(partyId, out var partyGuid))
        {
            var groupName = partyGuid.ToString();
            _logger.LogInformation("[SignalR Server] → Sending OnStateChanged: partyId={PartyId}, group={Group}", 
                partyId, groupName);
            await Clients.Group(groupName).SendAsync("OnStateChanged", partyId);
        }
        else
        {
            _logger.LogWarning("[SignalR Server] Invalid partyId format: {PartyId}", partyId);
        }
    }

    /// <summary>
    /// Уведомляет всех зрителей об изменении плейлиста (вызывается из контроллера через IHubContext)
    /// </summary>
    public async Task NotifyPlaylistChanged(string partyId)
    {
        _logger.LogInformation("[SignalR Server] ← Received NotifyPlaylistChanged: partyId={PartyId}, connectionId={ConnectionId}", 
            partyId, Context.ConnectionId);
        
        if (Guid.TryParse(partyId, out var partyGuid))
        {
            var groupName = partyGuid.ToString();
            _logger.LogInformation("[SignalR Server] → Sending OnPlaylistChanged: partyId={PartyId}, group={Group}", 
                partyId, groupName);
            await Clients.Group(groupName).SendAsync("OnPlaylistChanged", partyId);
        }
        else
        {
            _logger.LogWarning("[SignalR Server] Invalid partyId format: {PartyId}", partyId);
        }
    }

    public async Task JoinPartyAsOrganizer(string partyId, string token)
    {
        _logger.LogInformation("[SignalR Server] ← Received JoinPartyAsOrganizer: partyId={PartyId}, hasToken={HasToken}, connectionId={ConnectionId}", 
            partyId, !string.IsNullOrEmpty(token), Context.ConnectionId);
        
        // В минимальной версии пропускаем проверку токена
        if (Guid.TryParse(partyId, out var partyGuid))
        {
            var groupName = partyGuid.ToString();
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            _logger.LogInformation("[SignalR Server] Added connection to group: partyId={PartyId}, group={Group}, connectionId={ConnectionId}", 
                partyId, groupName, Context.ConnectionId);
        }
        else
        {
            _logger.LogWarning("[SignalR Server] Invalid partyId format: {PartyId}", partyId);
        }
    }

    public async Task StartSession(string partyId)
    {
        _logger.LogInformation("[SignalR Server] ← Received StartSession: partyId={PartyId}, connectionId={ConnectionId}", 
            partyId, Context.ConnectionId);
        
        // Пытаемся найти вечеринку по ID (Guid)
        Party? party = null;
        if (Guid.TryParse(partyId, out var partyGuid))
        {
            party = _partyStore.GetPartyById(partyGuid);
        }

        if (party == null)
        {
            _logger.LogWarning("[SignalR Server] → Sending Error: Party not found for partyId={PartyId}", partyId);
            await Clients.Caller.SendAsync("Error", "Party not found");
            return;
        }

        // Создаем начальное состояние сессии
        var initialState = new PlaybackStateDto
        {
            Status = "idle",
            Position = 0,
            Duration = 0,
            Volume = 0.8,
            Mode = "session",
            LastUpdatedAt = DateTime.UtcNow
        };
        _partyStore.SetSessionState(party.Id, initialState);

        var groupName = party.Id.ToString();
        _logger.LogInformation("[SignalR Server] → Sending OnSessionStarted: partyId={PartyId}, group={Group}", 
            partyId, groupName);
        await Clients.Group(groupName).SendAsync("OnSessionStarted", party.Id.ToString());
    }

    public async Task EndSession(string partyId)
    {
        _logger.LogInformation("[SignalR Server] ← Received EndSession: partyId={PartyId}, connectionId={ConnectionId}", 
            partyId, Context.ConnectionId);
        
        if (Guid.TryParse(partyId, out var partyGuid))
        {
            var groupName = partyGuid.ToString();
            _logger.LogInformation("[SignalR Server] → Sending OnSessionEnded: partyId={PartyId}, group={Group}", 
                partyId, groupName);
            await Clients.Group(groupName).SendAsync("OnSessionEnded", partyId);
        }
        else
        {
            _logger.LogWarning("[SignalR Server] Invalid partyId format: {PartyId}", partyId);
        }
    }
}

