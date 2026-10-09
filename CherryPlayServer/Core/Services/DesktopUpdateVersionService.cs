using CherryPlayServer.Core.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace CherryPlayServer.Core.Services;

public sealed class DesktopUpdateVersionService(
    IDesktopReleaseSource releaseSource,
    IMemoryCache cache,
    ILogger<DesktopUpdateVersionService> logger) : IDesktopUpdateVersionService
{
    public const string CacheEntryKey = "DesktopUpdate:LatestVersion";
    private readonly object _refreshLock = new();
    private Task? _backgroundRefresh;
    private string? _lastResolvedVersion;
    private bool _hasResolved;

    public Task<string?> GetLatestVersionAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(GetCachedLatestVersionOrScheduleRefresh());
    }

    private string? GetCachedLatestVersionOrScheduleRefresh()
    {
        lock (_refreshLock)
        {
            if (cache.TryGetValue(CacheEntryKey, out string? cachedVersion))
                return cachedVersion;

            var staleOrNull = _hasResolved ? _lastResolvedVersion : null;
            ScheduleBackgroundRefreshIfIdle();
            return staleOrNull;
        }
    }

    private void ScheduleBackgroundRefreshIfIdle()
    {
        if (_backgroundRefresh is null || _backgroundRefresh.IsCompleted)
            _backgroundRefresh = RefreshCacheInBackgroundAsync();
    }

    private async Task RefreshCacheInBackgroundAsync()
    {
        string? version;
        var resolved = false;
        try
        {
            version = await releaseSource.GetLatestVersionAsync(CancellationToken.None);
            resolved = true;
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Unable to retrieve the latest desktop release from GitHub");
            version = null;
        }

        lock (_refreshLock)
        {
            if (resolved)
            {
                _lastResolvedVersion = version;
                _hasResolved = true;
                cache.Set(CacheEntryKey, version, TimeSpan.FromMinutes(5));
                return;
            }

            cache.Set(CacheEntryKey, _hasResolved ? _lastResolvedVersion : null, TimeSpan.FromMinutes(5));
        }
    }
}
