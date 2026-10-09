using System.Diagnostics;
using CherryPlayServer.Core.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class DesktopUpdateVersionServiceTests
{
    [TestCase("0.7.0")]
    [TestCase(null)]
    public async Task GetLatestVersion_CacheMiss_ReturnsNullThenServesCachedResult(string? version)
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var source = new DesktopReleaseSourceStub(_ => Task.FromResult(version));
        var service = Create(source, cache);

        Assert.That(await service.GetLatestVersionAsync(), Is.Null);
        await WaitUntilCacheEntryAsync(cache, version);
        Assert.That(await service.GetLatestVersionAsync(), Is.EqualTo(version));
        Assert.That(source.Calls, Is.EqualTo(1));
        cache.Compact(1);
        Assert.That(await service.GetLatestVersionAsync(), Is.EqualTo(version));
        await WaitUntilCacheEntryAsync(cache, version);
        Assert.That(source.Calls, Is.EqualTo(2));
    }

    [TestCase("http")]
    [TestCase("timeout")]
    [TestCase("json")]
    [TestCase("invalid")]
    [TestCase("generic")]
    public async Task GetLatestVersion_CachesUnavailableResultAfterFailure(string failure)
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        Exception exception = failure switch
        {
            "http" => new HttpRequestException(),
            "timeout" => new OperationCanceledException(),
            "json" => new System.Text.Json.JsonException(),
            "invalid" => new InvalidDataException(),
            _ => new InvalidOperationException("unexpected failure")
        };
        var source = new DesktopReleaseSourceStub(_ => Task.FromException<string?>(exception));
        var service = Create(source, cache);

        Assert.That(await service.GetLatestVersionAsync(), Is.Null);
        await WaitUntilCacheEntryAsync(cache, null);
        Assert.That(await service.GetLatestVersionAsync(), Is.Null);
        Assert.That(source.Calls, Is.EqualTo(1));
    }

    [Test]
    public async Task GetLatestVersion_AfterSuccessfulFetch_FailureKeepsStaleAndBacksOff()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var fail = false;
        var source = new DesktopReleaseSourceStub(_ => fail
            ? Task.FromException<string?>(new InvalidOperationException())
            : Task.FromResult<string?>("0.7.0"));
        var service = Create(source, cache);

        Assert.That(await service.GetLatestVersionAsync(), Is.Null);
        await WaitUntilCacheEntryAsync(cache, "0.7.0");
        fail = true;
        cache.Compact(1);
        Assert.That(await service.GetLatestVersionAsync(), Is.EqualTo("0.7.0"));
        await WaitUntilCacheEntryAsync(cache, "0.7.0");
        Assert.That(await service.GetLatestVersionAsync(), Is.EqualTo("0.7.0"));
        Assert.That(source.Calls, Is.EqualTo(2));
    }

    [Test]
    public async Task GetLatestVersion_CacheMiss_DoesNotWaitForGitHubAndCoalescesRefresh()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var completion = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
        CancellationToken sourceToken = default;
        var source = new DesktopReleaseSourceStub(token => { sourceToken = token; return completion.Task; });
        var service = Create(source, cache);

        var stopwatch = Stopwatch.StartNew();
        var results = await Task.WhenAll(Enumerable.Range(0, 11).Select(_ => service.GetLatestVersionAsync()));
        stopwatch.Stop();

        Assert.That(results, Is.All.Null);
        Assert.That(stopwatch.Elapsed, Is.LessThan(TimeSpan.FromMilliseconds(500)));
        Assert.That(source.Calls, Is.EqualTo(1));
        Assert.That(sourceToken.IsCancellationRequested, Is.False);
        Assert.That(sourceToken.CanBeCanceled, Is.False);

        completion.SetResult("0.7.0");
        await WaitUntilCacheEntryAsync(cache, "0.7.0");
        Assert.That(await service.GetLatestVersionAsync(), Is.EqualTo("0.7.0"));
        Assert.That(source.Calls, Is.EqualTo(1));
    }

    [Test]
    public void GetLatestVersion_CanceledCaller_DoesNotStartRefreshWhenAlreadyCanceled()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var source = new DesktopReleaseSourceStub(_ => Task.FromResult<string?>("0.7.0"));
        var service = Create(source, cache);
        using var canceled = new CancellationTokenSource();
        canceled.Cancel();

        Assert.ThrowsAsync<OperationCanceledException>(() => service.GetLatestVersionAsync(canceled.Token));
        Assert.That(source.Calls, Is.EqualTo(0));
    }

    private static async Task WaitUntilCacheEntryAsync(IMemoryCache cache, string? expected)
    {
        for (var attempt = 0; attempt < 200; attempt++)
        {
            if (cache.TryGetValue(DesktopUpdateVersionService.CacheEntryKey, out string? cached))
            {
                Assert.That(cached, Is.EqualTo(expected));
                return;
            }

            await Task.Delay(10);
        }

        Assert.Fail($"Timed out waiting for cached desktop update version {expected ?? "null"}.");
    }

    private static DesktopUpdateVersionService Create(DesktopReleaseSourceStub source, IMemoryCache cache)
        => new(source, cache, NullLogger<DesktopUpdateVersionService>.Instance);
}
