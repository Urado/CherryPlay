using System.Net;

namespace CherryPlayServer.Tests;

[TestFixture]
[NonParallelizable]
public sealed class MetricsEndpointTests
{
    [Test]
    public async Task MetricsEndpoint_ExposesScrapeTextAndBoundedSignalRSeries()
    {
        await using var factory = new SessionParityWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/metrics");
        var body = await response.Content.ReadAsStringAsync();

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(body, Does.Contain("cherryplay_signalr_active_connections{transport=\"websocket\"}"));
        Assert.That(body, Does.Contain("cherryplay_signalr_active_connections{transport=\"other\"}"));
    }
}
