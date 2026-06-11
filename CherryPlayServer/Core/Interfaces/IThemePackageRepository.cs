using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IThemePackageRepository
{
    Task<List<ThemePackage>> GetAllActiveWithItemsAsync();
    Task<List<ThemePackage>> GetAllWithItemsAsync();
    Task<ThemePackage?> GetByIdAsync(Guid id);
    Task UpsertAsync(ThemePackage package);
}
