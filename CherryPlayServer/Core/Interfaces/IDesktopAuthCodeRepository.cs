using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IDesktopAuthCodeRepository
{
    Task<DesktopAuthCode> AddAsync(DesktopAuthCode code);
    Task<DesktopAuthCode?> GetValidByTokenHashAsync(string tokenHash);
    Task<bool> TryMarkUsedAsync(Guid codeId);
}
