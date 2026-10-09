namespace CherryPlayServer.Core.Interfaces;

public interface IDesktopUpdateVersionService
{
    Task<string?> GetLatestVersionAsync(CancellationToken cancellationToken = default);
}
