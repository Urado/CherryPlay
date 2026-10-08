using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Data;

public sealed class ThemeCatalogSeeder(
    IThemeRepository themeRepository,
    IThemePackageRepository themePackageRepository) : IThemeCatalogSeeder
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var existingThemes = await themeRepository.GetAllAsync();
        var existingPackages = await themePackageRepository.GetAllWithItemsAsync();
        var themeMap = new Dictionary<string, string>
        {
            ["basic"] = "Базовый",
            ["cyberpunk"] = "Cyberpunk",
            ["sakura"] = "Sakura",
            ["art-deco"] = "Art Deco",
            ["spring-cross-step"] = "Весенний кросс-степ",
        };
        var missingThemes = themeMap
            .Where(x => existingThemes.All(theme => theme.ThemeId != x.Key))
            .Select(x => new Theme { ThemeId = x.Key, DisplayName = x.Value, Visibility = ThemeVisibility.Public })
            .ToArray();
        if (missingThemes.Length > 0)
        {
            await themeRepository.AddRangeAsync(missingThemes);
        }

        await EnsurePackageAsync(existingPackages, new ThemePackage
        {
            Code = "free",
            Name = "Бесплатный",
            IsAutoGranted = true,
            IsActive = true,
            ThemeIds = ["basic"]
        });
        await EnsurePackageAsync(existingPackages, new ThemePackage
        {
            Code = "extended",
            Name = "Расширенный",
            IsAutoGranted = false,
            IsActive = true,
            ThemeIds = ["cyberpunk", "sakura", "art-deco"]
        });
        await EnsurePackageAsync(existingPackages, new ThemePackage
        {
            Code = "spring-cross-step",
            Name = "Весенний кросс-степ",
            IsAutoGranted = false,
            IsActive = true,
            ThemeIds = ["spring-cross-step"]
        });
    }

    private async Task EnsurePackageAsync(List<ThemePackage> existingPackages, ThemePackage canonicalPackage)
    {
        var existing = existingPackages.FirstOrDefault(package =>
            string.Equals(package.Code, canonicalPackage.Code, StringComparison.Ordinal));
        if (existing is null)
        {
            await themePackageRepository.UpsertAsync(canonicalPackage);
            return;
        }

        var mergedThemeIds = existing.ThemeIds
            .Concat(canonicalPackage.ThemeIds)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (mergedThemeIds.Count == existing.ThemeIds.Count)
        {
            return;
        }

        existing.ThemeIds = mergedThemeIds;
        await themePackageRepository.UpsertAsync(existing);
    }
}
