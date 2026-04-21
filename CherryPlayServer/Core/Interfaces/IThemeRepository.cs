using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IThemeRepository
{
    Task<Theme?> GetByIdAsync(string themeId);
    Task<List<Theme>> GetAllAsync();
    Task AddRangeAsync(IEnumerable<Theme> themes);
}
