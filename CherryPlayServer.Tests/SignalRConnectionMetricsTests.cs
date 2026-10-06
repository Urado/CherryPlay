using System.Reflection;
using CherryPlayServer.Infrastructure;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class SignalRConnectionMetricsTests
{
    [Test]
    public void AddAndRemove_TracksConnectionsOnceWithBoundedTransportLabels()
    {
        var metrics = new SignalRConnectionMetrics();
        metrics.Add("ws-1", true);
        metrics.Add("ws-1", false);
        metrics.Add("other-1", false);

        var connections = GetConnections(metrics);

        Assert.That(connections, Has.Count.EqualTo(2));
        Assert.That(connections.Values, Is.EquivalentTo(new[] { "websocket", "other" }));

        metrics.Remove("ws-1");
        metrics.Remove("ws-1");
        metrics.Remove("missing");

        Assert.That(connections, Has.Count.EqualTo(1));
        Assert.That(connections.Values.Single(), Is.EqualTo("other"));
    }

    private static Dictionary<string, string> GetConnections(SignalRConnectionMetrics metrics)
    {
        var field = typeof(SignalRConnectionMetrics).GetField("_connections", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.That(field, Is.Not.Null);
        return (Dictionary<string, string>)field!.GetValue(metrics)!;
    }
}
