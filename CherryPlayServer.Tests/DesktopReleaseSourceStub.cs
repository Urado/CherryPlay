using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Tests;

internal sealed class DesktopReleaseSourceStub(Func<CancellationToken, Task<string?>> getVersion) : IDesktopReleaseSource
{
    public int Calls { get; private set; }

    public Task<string?> GetLatestVersionAsync(CancellationToken cancellationToken)
    {
        Calls++;
        return getVersion(cancellationToken);
    }
}
