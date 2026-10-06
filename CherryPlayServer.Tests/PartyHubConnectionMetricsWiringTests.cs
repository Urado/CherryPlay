using CherryPlayServer.Hubs;
using CherryPlayServer.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace CherryPlayServer.Tests;

[TestFixture]
[NonParallelizable]
public sealed class PartyHubConnectionMetricsWiringTests
{
    [Test]
    public async Task HubConnectionCallbacks_UpdateScrapedTransportMetric()
    {
        await using var factory = new SessionParityWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var services = scope.ServiceProvider;
        var metrics = services.GetRequiredService<SignalRConnectionMetrics>();
        var connectionId = $"metrics-{Guid.NewGuid():N}";
        var httpContext = new DefaultHttpContext();
        const string transport = "other";
        var hub = ActivatorUtilities.CreateInstance<PartyHub>(
            services,
            new SessionParityHubContext(new SessionParityHubClients(), new SessionParityGroupManager()));
        hub.Context = new PartyHubConnectionMetricsCallerContext(httpContext, connectionId);

        await hub.OnConnectedAsync();
        var connectedScrape = await client.GetStringAsync("/metrics");

        Assert.That(connectedScrape, Does.Contain($"cherryplay_signalr_active_connections{{transport=\"{transport}\"}}"));
        Assert.That(GetGaugeValue(connectedScrape, transport), Is.GreaterThan(0));

        await hub.OnDisconnectedAsync(null);
        var disconnectedScrape = await client.GetStringAsync("/metrics");

        Assert.That(GetGaugeValue(disconnectedScrape, transport), Is.EqualTo(0));
        hub.Dispose();
    }

    private static double GetGaugeValue(string scrape, string transport)
    {
        var prefix = $"cherryplay_signalr_active_connections{{transport=\"{transport}\"}} ";
        var line = scrape.Split('\n').Single(value => value.StartsWith(prefix, StringComparison.Ordinal));
        return double.Parse(line[prefix.Length..], System.Globalization.CultureInfo.InvariantCulture);
    }
}
