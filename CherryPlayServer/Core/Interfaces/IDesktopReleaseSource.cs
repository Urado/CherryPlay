namespace CherryPlayServer.Core.Interfaces;

public interface IDesktopReleaseSource
{
    Task<string?> GetLatestVersionAsync(CancellationToken cancellationToken);
}
