using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;
using Microsoft.Extensions.Configuration;

namespace CherryPlayServer.Tests;

public class ThemeAccessServiceRulesTests
{
    [Test]
    public async Task CheckThemeAccess_AutoGrantedPackage_GrantsWithoutEntitlementRows()
    {
        var organizerId = Guid.NewGuid();
        var service = await CreateServiceAsync(
            themes: [Theme("basic")],
            packages: [Package("free", isAutoGranted: true, themeIds: ["basic"])]);

        var result = await service.CheckThemeAccessAsync(organizerId, "basic");

        Assert.That(result.IsAllowed, Is.True);
        Assert.That(result.IsThemeVisible, Is.True);
    }

    [Test]
    public async Task CheckThemeAccess_ActiveEntitlement_GrantsAccess()
    {
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var service = await CreateServiceAsync(
            themes: [Theme("cyberpunk")],
            packages: [Package("extended", id: packageId, themeIds: ["cyberpunk"])],
            entitlements:
            [
                new OrganizerEntitlement
                {
                    Id = Guid.NewGuid(),
                    OrganizerId = organizerId,
                    PackageId = packageId,
                    GrantedAt = DateTime.UtcNow.AddMinutes(-2),
                },
            ]);

        var result = await service.CheckThemeAccessAsync(organizerId, "cyberpunk");

        Assert.That(result.IsAllowed, Is.True);
        Assert.That(result.RequiredPackageCodes, Is.Empty);
    }

    [TestCase(true, false, null)]
    [TestCase(false, true, null)]
    [TestCase(false, false, 0)]
    public async Task CheckThemeAccess_RevokedExpiredOrExhaustedEntitlement_DoesNotGrant(
        bool revoked,
        bool expired,
        int? usesRemaining)
    {
        var organizerId = Guid.NewGuid();
        var packageId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var service = await CreateServiceAsync(
            themes: [Theme("cyberpunk")],
            packages: [Package("extended", id: packageId, themeIds: ["cyberpunk"])],
            entitlements:
            [
                new OrganizerEntitlement
                {
                    Id = Guid.NewGuid(),
                    OrganizerId = organizerId,
                    PackageId = packageId,
                    GrantedAt = now.AddDays(-2),
                    RevokedAt = revoked ? now.AddMinutes(-1) : null,
                    ExpiresAt = expired ? now.AddMinutes(-1) : now.AddDays(1),
                    UsesRemaining = usesRemaining,
                },
            ]);

        var result = await service.CheckThemeAccessAsync(organizerId, "cyberpunk");

        Assert.That(result.IsAllowed, Is.False);
        Assert.That(result.IsThemeVisible, Is.True);
        Assert.That(result.RequiredPackageCodes, Does.Contain("extended"));
    }

    [Test]
    public async Task GetAccessSummary_PrivateInaccessibleTheme_IsHidden()
    {
        var organizerId = Guid.NewGuid();
        var service = await CreateServiceAsync(
            themes:
            [
                Theme("basic"),
                Theme("vip-only", visibility: ThemeVisibility.Private),
            ],
            packages:
            [
                Package("free", isAutoGranted: true, themeIds: ["basic"]),
                Package("vip-pack", themeIds: ["vip-only"]),
            ]);

        var summary = await service.GetAccessSummaryAsync(organizerId);

        Assert.That(summary.GrantedThemeIds, Does.Not.Contain("vip-only"));
        Assert.That(summary.VisibleLockedThemes.Any(x => x.ThemeId == "vip-only"), Is.False);
    }

    [Test]
    public async Task GetAccessSummary_PublicInaccessibleTheme_ShowsLockedWithPackageInfo()
    {
        var organizerId = Guid.NewGuid();
        var service = await CreateServiceAsync(
            themes:
            [
                Theme("basic"),
                Theme("cyberpunk"),
            ],
            packages:
            [
                Package("free", isAutoGranted: true, themeIds: ["basic"]),
                Package("extended", themeIds: ["cyberpunk"]),
            ]);

        var summary = await service.GetAccessSummaryAsync(organizerId);
        Assert.That(summary.VisibleLockedThemes, Has.Count.EqualTo(1));
        var locked = summary.VisibleLockedThemes.Single();
        Assert.That(locked.ThemeId, Is.EqualTo("cyberpunk"));
        Assert.That(locked.PackageCode, Is.EqualTo("extended"));
    }

    [Test]
    public async Task GetAccessSummary_WhenThemeInMultiplePackages_UsesCanonicalCodeOrder()
    {
        var organizerId = Guid.NewGuid();
        var service = await CreateServiceAsync(
            themes: [Theme("sakura")],
            packages:
            [
                Package("zzz-pack", themeIds: ["sakura"]),
                Package("aaa-pack", themeIds: ["sakura"]),
            ]);

        var summary = await service.GetAccessSummaryAsync(organizerId);
        Assert.That(summary.VisibleLockedThemes, Has.Count.EqualTo(1));
        var locked = summary.VisibleLockedThemes.Single();
        Assert.That(locked.PackageCode, Is.EqualTo("aaa-pack"));
    }

    [Test]
    public async Task GetAccessSummary_ContactUrl_PrefersEnvironmentVariableThenConfigThenFallback()
    {
        var withEnv = await CreateServiceAsync(
            [],
            [],
            configurationValue: "https://config-admin.example",
            environmentContactUrl: "https://env-admin.example");
        var envSummary = await withEnv.GetAccessSummaryAsync(Guid.NewGuid());
        Assert.That(envSummary.ContactUrl, Is.EqualTo("https://env-admin.example"));

        var withConfig = await CreateServiceAsync(
            [],
            [],
            configurationValue: "https://config-admin.example",
            environmentContactUrl: null);
        var configSummary = await withConfig.GetAccessSummaryAsync(Guid.NewGuid());
        Assert.That(configSummary.ContactUrl, Is.EqualTo("https://config-admin.example"));

        var withFallback = await CreateServiceAsync([], [], configurationValue: null, environmentContactUrl: null);
        var fallbackSummary = await withFallback.GetAccessSummaryAsync(Guid.NewGuid());
        Assert.That(fallbackSummary.ContactUrl, Is.EqualTo("https://vk.com/<owner>"));
    }

    private static async Task<ThemeAccessService> CreateServiceAsync(
        IReadOnlyList<Theme> themes,
        IReadOnlyList<ThemePackage> packages,
        IReadOnlyList<OrganizerEntitlement>? entitlements = null,
        string? configurationValue = "https://config.example",
        string? environmentContactUrl = null)
    {
        var themeRepository = new InMemoryThemeRepository();
        await themeRepository.AddRangeAsync(themes);

        var packageRepository = new InMemoryThemePackageRepository();
        foreach (var package in packages)
        {
            await packageRepository.UpsertAsync(package);
        }

        var entitlementRepository = new InMemoryOrganizerEntitlementRepository();
        if (entitlements != null)
        {
            foreach (var entitlement in entitlements)
            {
                await entitlementRepository.AddAsync(entitlement);
            }
        }

        var configValues = new Dictionary<string, string?>();
        if (configurationValue != null)
        {
            configValues["Admin:ContactUrl"] = configurationValue;
        }

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(configValues)
            .Build();

        return new ThemeAccessService(
            themeRepository,
            packageRepository,
            entitlementRepository,
            configuration,
            () => environmentContactUrl);
    }

    private static Theme Theme(string themeId, ThemeVisibility visibility = ThemeVisibility.Public) => new()
    {
        ThemeId = themeId,
        DisplayName = themeId,
        Visibility = visibility,
    };

    private static ThemePackage Package(
        string code,
        bool isAutoGranted = false,
        bool isActive = true,
        Guid? id = null,
        List<string>? themeIds = null) => new()
    {
        Id = id ?? Guid.NewGuid(),
        Code = code,
        Name = code,
        IsAutoGranted = isAutoGranted,
        IsActive = isActive,
        ThemeIds = themeIds ?? [],
    };
}
