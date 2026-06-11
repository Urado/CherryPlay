using System.Collections.Concurrent;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Repositories;

public class InMemoryThemePackageRepository : IThemePackageRepository
{
    private readonly ConcurrentDictionary<Guid, ThemePackage> _packagesById = new();
    private readonly ConcurrentDictionary<string, Guid> _idByCode = new(StringComparer.Ordinal);

    public Task<List<ThemePackage>> GetAllActiveWithItemsAsync()
    {
        var packages = _packagesById.Values
            .Where(x => x.IsActive)
            .OrderBy(x => x.Code, StringComparer.Ordinal)
            .Select(Clone)
            .ToList();
        return Task.FromResult(packages);
    }

    public Task<List<ThemePackage>> GetAllWithItemsAsync()
    {
        var packages = _packagesById.Values
            .OrderBy(x => x.Code, StringComparer.Ordinal)
            .Select(Clone)
            .ToList();
        return Task.FromResult(packages);
    }

    public Task<ThemePackage?> GetByIdAsync(Guid id)
    {
        _packagesById.TryGetValue(id, out var package);
        return Task.FromResult(package is null ? null : Clone(package));
    }

    public Task UpsertAsync(ThemePackage package)
    {
        var hasCodeMatch = _idByCode.TryGetValue(package.Code, out var existingId);
        var id = hasCodeMatch ? existingId : package.Id == Guid.Empty ? Guid.NewGuid() : package.Id;
        var stored = Clone(package);
        stored.Id = id;
        stored.ThemeIds = package.ThemeIds
            .Distinct(StringComparer.Ordinal)
            .OrderBy(x => x, StringComparer.Ordinal)
            .ToList();

        _packagesById.AddOrUpdate(id, stored, (_, _) => stored);
        _idByCode[stored.Code] = stored.Id;
        return Task.CompletedTask;
    }

    private static ThemePackage Clone(ThemePackage package) => new()
    {
        Id = package.Id,
        Code = package.Code,
        Name = package.Name,
        IsAutoGranted = package.IsAutoGranted,
        IsActive = package.IsActive,
        ThemeIds = [.. package.ThemeIds],
    };
}
