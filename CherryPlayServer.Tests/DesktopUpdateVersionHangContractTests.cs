using System.Diagnostics;
using System.Net;
using System.Text.Json;
using CherryPlayServer.Core.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class DesktopUpdateVersionHangContractTests
{
    [Test]
    public async Task GetConfig_HangingReleaseSource_ReturnsQuicklyWithNull()
    {
        var hang = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        await using var factory = new HangingDesktopReleaseWebApplicationFactory(_ => hang.Task);
        using var client = factory.CreateClient();

        var stopwatch = Stopwatch.StartNew();
        using var response = await client.GetAsync("/api/config");
        stopwatch.Stop();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(stopwatch.Elapsed, Is.LessThan(TimeSpan.FromMilliseconds(500)));
        Assert.That(json.RootElement.GetProperty("desktopUpdateVersion").ValueKind,
            Is.EqualTo(JsonValueKind.Null));
    }

    [Test]
    public async Task GetConfig_AfterStaleExpiry_HangingRefresh_ReturnsLastKnownQuickly()
    {
        var gate = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var calls = 0;
        await using var factory = new HangingDesktopReleaseWebApplicationFactory(_ =>
        {
            calls++;
            return calls == 1 ? Task.FromResult<string?>("0.8.0") : gate.Task;
        });
        using var client = factory.CreateClient();

        for (var attempt = 0; attempt < 200; attempt++)
        {
            using var probe = await client.GetAsync("/api/config");
            using var probeJson = JsonDocument.Parse(await probe.Content.ReadAsStringAsync());
            if (probeJson.RootElement.GetProperty("desktopUpdateVersion").GetString() == "0.8.0")
                break;
            await Task.Delay(10);
            if (attempt == 199)
                Assert.Fail("Timed out waiting for warm desktopUpdateVersion 0.8.0.");
        }

        var cache = factory.Services.GetRequiredService<IMemoryCache>();
        cache.Remove(DesktopUpdateVersionService.CacheEntryKey);

        var stopwatch = Stopwatch.StartNew();
        using var response = await client.GetAsync("/api/config");
        stopwatch.Stop();
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));
        Assert.That(stopwatch.Elapsed, Is.LessThan(TimeSpan.FromMilliseconds(500)));
        Assert.That(json.RootElement.GetProperty("desktopUpdateVersion").GetString(),
            Is.EqualTo("0.8.0"));
    }
}
