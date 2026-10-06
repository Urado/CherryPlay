using System.Net;

namespace CherryPlayServer.Tests;

[TestFixture]
[NonParallelizable]
public sealed class HttpRequestMetricsTests
{
    [Test]
    public async Task CompletedHttpRequest_IncrementsScrapedRequestMetric()
    {
        await using var factory = new SessionParityWebApplicationFactory();
        using var client = factory.CreateClient();
        var before = await client.GetStringAsync("/metrics");

        var response = await client.GetAsync("/api/config");
        var metrics = await client.GetStringAsync("/metrics");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(GetGetRequestCount(metrics), Is.GreaterThan(GetGetRequestCount(before)));
    }

    private static double GetGetRequestCount(string scrape) => scrape
        .Split('\n')
        .Where(line => line.StartsWith("http_requests_received_total{", StringComparison.Ordinal)
            && line.Contains("method=\"GET\"", StringComparison.Ordinal))
        .Select(line => double.Parse(line[(line.LastIndexOf('}') + 1)..], System.Globalization.CultureInfo.InvariantCulture))
        .Sum();
}
