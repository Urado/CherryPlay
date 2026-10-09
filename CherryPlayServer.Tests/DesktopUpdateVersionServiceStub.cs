using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Tests;

internal sealed class DesktopUpdateVersionServiceStub(string? version = null) : IDesktopUpdateVersionService
{
    public Task<string?> GetLatestVersionAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(version);
}
