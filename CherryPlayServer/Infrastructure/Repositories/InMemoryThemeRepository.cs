using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryThemeRepository : IThemeRepository
{
    private readonly ConcurrentDictionary<string, Theme> _themes = new(StringComparer.Ordinal);

    public Task<Theme?> GetByIdAsync(string themeId)
    {
        _themes.TryGetValue(themeId, out var theme);
        return Task.FromResult(theme);
    }

    public Task<List<Theme>> GetAllAsync()
    {
        return Task.FromResult(_themes.Values.ToList());
    }

    public Task AddRangeAsync(IEnumerable<Theme> themes)
    {
        foreach (var theme in themes)
        {
            _themes.TryAdd(theme.ThemeId, theme);
        }

        return Task.CompletedTask;
    }
}
