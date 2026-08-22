namespace CherryPlayServer.Core.Interfaces;

public interface IDesktopAuthCodeService
{
    Task<string> IssueCodeAsync(Guid organizerId);
    Task<string?> ExchangeAsync(string rawCode);
}
