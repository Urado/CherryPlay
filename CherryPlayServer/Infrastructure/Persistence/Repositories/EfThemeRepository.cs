using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfThemeRepository : IThemeRepository
{
    private readonly AppDbContext _context;

    public EfThemeRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Theme?> GetByIdAsync(string themeId)
    {
        var ef = await _context.Themes.AsNoTracking().FirstOrDefaultAsync(x => x.ThemeId == themeId);
        return ef == null ? null : ToDomain(ef);
    }

    public async Task<List<Theme>> GetAllAsync()
    {
        return (await _context.Themes.AsNoTracking().ToListAsync()).Select(ToDomain).ToList();
    }

    public async Task AddRangeAsync(IEnumerable<Theme> themes)
    {
        var efs = themes.Select(t => new Persistence.Entities.ThemeEf
        {
            ThemeId = t.ThemeId,
            DisplayName = t.DisplayName,
            Description = t.Description,
            Visibility = t.Visibility == ThemeVisibility.Private ? "private" : "public",
        });
        await _context.Themes.AddRangeAsync(efs);
        await _context.SaveChangesAsync();
    }

    private static Theme ToDomain(Persistence.Entities.ThemeEf ef) => new()
    {
        ThemeId = ef.ThemeId,
        DisplayName = ef.DisplayName,
        Description = ef.Description,
        Visibility = ef.Visibility == "private" ? ThemeVisibility.Private : ThemeVisibility.Public,
    };
}
