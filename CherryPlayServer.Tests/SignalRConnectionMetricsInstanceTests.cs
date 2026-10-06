using CherryPlayServer.Infrastructure;

namespace CherryPlayServer.Tests;

[TestFixture]
[NonParallelizable]
public sealed class SignalRConnectionMetricsInstanceTests
{
    [Test]
    public async Task ConstructingAnotherInstance_PreservesActiveScrapedConnectionCount()
    {
        await using var factory = new SessionParityWebApplicationFactory();
        using var client = factory.CreateClient();
        var baselineScrape = await client.GetStringAsync("/metrics");
        var baseline = GetGaugeValue(baselineScrape, "other");
        var first = new SignalRConnectionMetrics();
        var connectionId = $"shared-gauge-{Guid.NewGuid():N}";

        first.Add(connectionId, false);
        var afterAdd = GetGaugeValue(await client.GetStringAsync("/metrics"), "other");
        _ = new SignalRConnectionMetrics();
        var afterSecondInstance = GetGaugeValue(await client.GetStringAsync("/metrics"), "other");

        Assert.That(afterAdd, Is.EqualTo(baseline + 1));
        Assert.That(afterSecondInstance, Is.EqualTo(afterAdd));

        first.Remove(connectionId);
        Assert.That(GetGaugeValue(await client.GetStringAsync("/metrics"), "other"), Is.EqualTo(baseline));
    }

    private static double GetGaugeValue(string scrape, string transport)
    {
        var prefix = $"cherryplay_signalr_active_connections{{transport=\"{transport}\"}} ";
        var line = scrape.Split('\n').Single(value => value.StartsWith(prefix, StringComparison.Ordinal));
        return double.Parse(line[prefix.Length..], System.Globalization.CultureInfo.InvariantCulture);
    }
}
