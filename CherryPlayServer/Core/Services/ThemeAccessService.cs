using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Utils;

namespace CherryPlayServer.Core.Services;

public class ThemeAccessService : IThemeAccessService
{
    private readonly IThemeRepository _themeRepository;
    private readonly IThemePackageRepository _packageRepository;
    private readonly IOrganizerEntitlementRepository _entitlementRepository;
    private readonly IConfiguration _configuration;
    private readonly Func<string?> _adminContactUrlFromEnvironment;

    public ThemeAccessService(
        IThemeRepository themeRepository,
        IThemePackageRepository packageRepository,
        IOrganizerEntitlementRepository entitlementRepository,
        IConfiguration configuration,
        Func<string?>? adminContactUrlFromEnvironment = null)
    {
        _themeRepository = themeRepository;
        _packageRepository = packageRepository;
        _entitlementRepository = entitlementRepository;
        _configuration = configuration;
        _adminContactUrlFromEnvironment = adminContactUrlFromEnvironment
            ?? (() => Environment.GetEnvironmentVariable("ADMIN_CONTACT_URL"));
    }

    public async Task<ThemeAccessSummary> GetAccessSummaryAsync(Guid organizerId)
    {
        var themes = await _themeRepository.GetAllAsync();
        var activePackages = await _packageRepository.GetAllActiveWithItemsAsync();
        var entitlements = await _entitlementRepository.GetByOrganizerIdAsync(organizerId);
        var now = DateTime.UtcNow;

        var grantedPackageIds = entitlements
            .Where(x => EntitlementRules.IsActiveAt(x, now))
            .Select(x => x.PackageId)
            .ToHashSet();

        var visibleThemeIds = themes
            .Select(t => t.ThemeId)
            .ToHashSet(StringComparer.Ordinal);

        var grantedThemeIds = activePackages
            .Where(p => p.IsAutoGranted || grantedPackageIds.Contains(p.Id))
            .SelectMany(p => p.ThemeIds)
            .Where(themeId => visibleThemeIds.Contains(themeId))
            .Distinct(StringComparer.Ordinal)
            .OrderBy(x => x, StringComparer.Ordinal)
            .ToList();

        var locked = new List<LockedThemeInfo>();
        foreach (var theme in themes.Where(t => !grantedThemeIds.Contains(t.ThemeId) && t.Visibility == Enums.ThemeVisibility.Public).OrderBy(t => t.ThemeId))
        {
            var pkg = activePackages
                .Where(p => !p.IsAutoGranted && p.ThemeIds.Contains(theme.ThemeId))
                .OrderBy(p => p.Code)
                .FirstOrDefault();
            if (pkg != null)
            {
                locked.Add(new LockedThemeInfo(theme.ThemeId, pkg.Code, pkg.Name));
            }
        }

        return new ThemeAccessSummary(
            GrantedThemeIds: grantedThemeIds,
            VisibleLockedThemes: locked,
            ContactUrl: _adminContactUrlFromEnvironment()
                ?? _configuration["Admin:ContactUrl"]
                ?? "https://vk.com/<owner>");
    }

    public async Task<ThemeAccessCheckResult> CheckThemeAccessAsync(Guid organizerId, string themeId)
    {
        var theme = await _themeRepository.GetByIdAsync(themeId);
        if (theme == null)
        {
            return new ThemeAccessCheckResult(false, false, []);
        }

        var summary = await GetAccessSummaryAsync(organizerId);
        if (summary.GrantedThemeIds.Contains(themeId, StringComparer.Ordinal))
        {
            return new ThemeAccessCheckResult(true, true, []);
        }

        var required = summary.VisibleLockedThemes.Where(x => x.ThemeId == themeId).Select(x => x.PackageCode).Distinct(StringComparer.Ordinal).ToList();
        return new ThemeAccessCheckResult(false, true, required);
    }
}
