using Microsoft.AspNetCore.SignalR;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Options;
using CherryPlayServer.Infrastructure;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Hubs;

public partial class PartyHub : Hub
{
    private readonly IStreamingService _streamingService;
    private readonly IPartyIdValidator _partyIdValidator;
    private readonly IJwtService _jwtService;
    private readonly IPartyAccessService _partyAccessService;
    private readonly IOrganizerConnectionTracker _organizerConnectionTracker;
    private readonly IPartyRepository _partyRepository;
    private readonly IStreamingRepository _streamingRepository;
    private readonly IOrganizerSessionRepository _organizerSessionRepository;
    private readonly IPartyDisplayStatusService _partyDisplayStatusService;
    private readonly IHubContext<PartyHub> _hubContext;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly PartyDisplayStatusOptions _displayStatusOptions;
    private readonly ILogger<PartyHub> _logger;
    private readonly SignalRConnectionMetrics? _connectionMetrics;

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
        ILogger<PartyHub> logger,
        IOrganizerSessionRepository organizerSessionRepository,
        SignalRConnectionMetrics? connectionMetrics = null)
    {
        _streamingService = streamingService ?? throw new ArgumentNullException(nameof(streamingService));
        _partyIdValidator = partyIdValidator ?? throw new ArgumentNullException(nameof(partyIdValidator));
        _jwtService = jwtService ?? throw new ArgumentNullException(nameof(jwtService));
        _partyAccessService = partyAccessService ?? throw new ArgumentNullException(nameof(partyAccessService));
        _organizerConnectionTracker = organizerConnectionTracker ?? throw new ArgumentNullException(nameof(organizerConnectionTracker));
        _partyRepository = partyRepository ?? throw new ArgumentNullException(nameof(partyRepository));
        _streamingRepository = streamingRepository ?? throw new ArgumentNullException(nameof(streamingRepository));
        _organizerSessionRepository = organizerSessionRepository ?? throw new ArgumentNullException(nameof(organizerSessionRepository));
        _partyDisplayStatusService = partyDisplayStatusService
            ?? throw new ArgumentNullException(nameof(partyDisplayStatusService));
        _hubContext = hubContext ?? throw new ArgumentNullException(nameof(hubContext));
        _scopeFactory = scopeFactory ?? throw new ArgumentNullException(nameof(scopeFactory));
        _displayStatusOptions = displayStatusOptions?.Value
            ?? throw new ArgumentNullException(nameof(displayStatusOptions));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _connectionMetrics = connectionMetrics;
    }

    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
        var httpContext = Context.GetHttpContext();
        _connectionMetrics?.Add(
            Context.ConnectionId,
            httpContext?.WebSockets.IsWebSocketRequest == true);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var connectionId = Context.ConnectionId;
        try
        {
            var partyId = _organizerConnectionTracker.TryRemoveOrganizer(connectionId);
            if (partyId.HasValue)
            {
                var partyIdStr = partyId.Value.ToString();
                _logger.LogInformation(
                    "[SignalR Server] Organizer disconnected: partyId={PartyId}",
                    partyId.Value);
                try
                {
                    await Clients.Group(partyIdStr).SendAsync("OnConnectionStatusChanged", partyIdStr, false);
                    await NotifyPartyDisplayStatusChangedAsync(partyId.Value);
                    ScheduleOrganizerOfflineStatusAfterGrace(partyId.Value);
                    _logger.LogInformation("[SignalR Server] -> Organizer disconnect: status updated");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("[SignalR Server] Failed to notify on organizer disconnect: failureType={FailureType}, failureLocation={FailureLocation}", ex.GetType().Name, CherryPlayServer.Core.Diagnostics.ExceptionDiagnostics.GetFailureLocation(ex));
                }
            }
        }
        finally
        {
            try
            {
                await base.OnDisconnectedAsync(exception);
            }
            finally
            {
                _connectionMetrics?.Remove(connectionId);
            }
        }
    }
}
