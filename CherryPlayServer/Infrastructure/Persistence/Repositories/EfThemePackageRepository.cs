using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Infrastructure.Persistence.Repositories;

public class EfThemePackageRepository : IThemePackageRepository
{
    private readonly AppDbContext _context;

    public EfThemePackageRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<List<ThemePackage>> GetAllActiveWithItemsAsync() =>
        (await _context.ThemePackages.AsNoTracking().Include(x => x.Items).Where(x => x.IsActive).ToListAsync()).Select(ToDomain).ToList();

    public async Task<List<ThemePackage>> GetAllWithItemsAsync() =>
        (await _context.ThemePackages.AsNoTracking().Include(x => x.Items).OrderBy(x => x.Code).ToListAsync()).Select(ToDomain).ToList();

    public async Task<ThemePackage?> GetByIdAsync(Guid id)
    {
        var ef = await _context.ThemePackages.AsNoTracking().Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id);
        return ef == null ? null : ToDomain(ef);
    }

    public async Task UpsertAsync(ThemePackage package)
    {
        var ef = await _context.ThemePackages.Include(x => x.Items).FirstOrDefaultAsync(x => x.Code == package.Code);
        if (ef == null)
        {
            ef = new Persistence.Entities.ThemePackageEf
            {
                Id = package.Id == Guid.Empty ? Guid.NewGuid() : package.Id,
                Code = package.Code,
                Name = package.Name,
                IsAutoGranted = package.IsAutoGranted,
                IsActive = package.IsActive,
            };
            _context.ThemePackages.Add(ef);
            foreach (var themeId in package.ThemeIds.Distinct(StringComparer.Ordinal))
            {
                ef.Items.Add(new Persistence.Entities.ThemePackageItemEf { PackageId = ef.Id, ThemeId = themeId });
            }
            await _context.SaveChangesAsync();
            return;
        }

        var existingThemeIds = ef.Items.Select(x => x.ThemeId).ToHashSet(StringComparer.Ordinal);
        var missingThemeIds = package.ThemeIds
            .Distinct(StringComparer.Ordinal)
            .Where(themeId => !existingThemeIds.Contains(themeId))
            .ToList();

        if (missingThemeIds.Count == 0)
        {
            return;
        }

        foreach (var themeId in missingThemeIds)
        {
            ef.Items.Add(new Persistence.Entities.ThemePackageItemEf { PackageId = ef.Id, ThemeId = themeId });
        }

        await _context.SaveChangesAsync();
    }

    private static ThemePackage ToDomain(Persistence.Entities.ThemePackageEf ef) => new()
    {
        Id = ef.Id,
        Code = ef.Code,
        Name = ef.Name,
        IsAutoGranted = ef.IsAutoGranted,
        IsActive = ef.IsActive,
        ThemeIds = ef.Items.Select(x => x.ThemeId).OrderBy(x => x).ToList(),
    };
}
