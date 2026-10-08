using Prometheus;

namespace CherryPlayServer.Infrastructure;

public sealed class SignalRConnectionMetrics
{
    private const string WebSocketTransport = "websocket";
    private const string OtherTransport = "other";
    private static readonly Gauge ActiveConnections = Metrics.CreateGauge(
        "cherryplay_signalr_active_connections",
        "Current number of active SignalR connections by negotiated transport.",
        new GaugeConfiguration { LabelNames = ["transport"] });

    static SignalRConnectionMetrics()
    {
        ActiveConnections.WithLabels(WebSocketTransport).Set(0);
        ActiveConnections.WithLabels(OtherTransport).Set(0);
    }

    private readonly Dictionary<string, string> _connections = new(StringComparer.Ordinal);
    private readonly object _sync = new();

    public void Add(string connectionId, bool isWebSocket)
    {
        lock (_sync)
        {
            var transport = isWebSocket ? WebSocketTransport : OtherTransport;
            if (_connections.TryAdd(connectionId, transport))
            {
                ActiveConnections.WithLabels(transport).Inc();
            }
        }
    }

    public void Remove(string connectionId)
    {
        lock (_sync)
        {
            if (_connections.Remove(connectionId, out var transport))
            {
                ActiveConnections.WithLabels(transport).Dec();
            }
        }
    }
}
