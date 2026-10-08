using System.Globalization;
using System.Net;

namespace CherryPlayServer.Tests;

[TestFixture]
[NonParallelizable]
public sealed class RequestFailureMetricsTests
{
    [Test]
    public async Task FailedRequest_ReturnsServerErrorAndIncrementsFiveXxMetric()
    {
        await using var factory = new RequestFailureMetricsWebApplicationFactory();
        using var client = factory.CreateClient();
        var before = await client.GetStringAsync("/metrics");

        var response = await client.GetAsync("/api/parties/public/runtime-smoke");
        var after = await client.GetStringAsync("/metrics");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.InternalServerError));
        Assert.That(GetFiveXxGetCount(after), Is.GreaterThan(GetFiveXxGetCount(before)));
    }

    private static double GetFiveXxGetCount(string scrape) => scrape
        .Split('\n')
        .Where(line => line.StartsWith("http_requests_received_total{", StringComparison.Ordinal)
            && line.Contains("method=\"GET\"", StringComparison.Ordinal)
            && line.Contains("code=\"5xx\"", StringComparison.Ordinal))
        .Select(line => double.Parse(
            line[(line.LastIndexOf('}') + 1)..],
            CultureInfo.InvariantCulture))
        .Sum();
}
