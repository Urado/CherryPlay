using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Repositories;

public sealed class InMemoryAdminQueryRepository : IAdminQueryRepository
{
    private readonly IAdminEntitlementRepository _entitlements;
    private readonly IOrganizerRepository _organizers;
    private readonly IEmailAccountRepository _emails;
    private readonly IOAuthAccountRepository _oauth;
    private readonly IThemePackageRepository _packages;

    public InMemoryAdminQueryRepository(
        IAdminEntitlementRepository entitlements,
        IOrganizerRepository organizers,
        IEmailAccountRepository emails,
        IOAuthAccountRepository oauth,
        IThemePackageRepository packages)
    {
        _entitlements = entitlements;
        _organizers = organizers;
        _emails = emails;
        _oauth = oauth;
        _packages = packages;
    }

    public async Task<IReadOnlyList<AdminThemePackageView>> GetPackagesAsync()
    {
        var packages = await _packages.GetAllWithItemsAsync();
        return Array.AsReadOnly(packages.Select(package => new AdminThemePackageView(
            package.Id,
            package.Code,
            package.Name,
            package.IsAutoGranted,
            package.IsActive,
            Array.AsReadOnly(package.ThemeIds.ToArray()))).ToArray());
    }

    public async Task<AdminOrganizerListView> GetOrganizersAsync(string? query, int page, int pageSize)
    {
        IEnumerable<Organizer> organizers = await _organizers.GetAllForAdminAsync();
        if (!string.IsNullOrWhiteSpace(query))
        {
            var search = query.Trim();
            var matches = new List<Organizer>();
            foreach (var organizer in organizers)
            {
                var email = await _emails.GetByOrganizerIdAsync(organizer.Id);
                if (organizer.Name.Contains(search, StringComparison.OrdinalIgnoreCase)
                    || email?.Email.Contains(search, StringComparison.OrdinalIgnoreCase) == true)
                {
                    matches.Add(organizer);
                }
            }
            organizers = matches;
        }

        var organizerRows = organizers.ToArray();
        var total = organizerRows.Length;
        var offset = (long)(page - 1) * pageSize;
        var rows = offset >= total ? [] : organizerRows.Skip((int)offset).Take(pageSize).ToArray();
        var items = new List<AdminOrganizerListItemView>(rows.Length);
        foreach (var organizer in rows)
        {
            var email = await _emails.GetByOrganizerIdAsync(organizer.Id);
            var accounts = await _oauth.GetByOrganizerIdAsync(organizer.Id);
            var entitlements = await _entitlements.GetOrganizerEntitlementsAsync(organizer.Id, true);
            items.Add(new AdminOrganizerListItemView(
                organizer.Id,
                organizer.Name,
                email?.Email,
                Array.AsReadOnly(accounts.Select(account => account.Provider.ToString().ToLowerInvariant()).Distinct().OrderBy(x => x).ToArray()),
                organizer.Role == OrganizerRole.Admin ? "admin" : "organizer",
                entitlements.Count,
                organizer.CreatedAt));
        }

        return new AdminOrganizerListView(Array.AsReadOnly(items.ToArray()), total, page, pageSize);
    }

    public async Task<AdminOrganizerDetailView?> GetOrganizerAsync(Guid organizerId)
    {
        var organizer = await _organizers.GetByIdAsync(organizerId);
        if (organizer is null) return null;
        var email = await _emails.GetByOrganizerIdAsync(organizerId);
        var oauthAccounts = await _oauth.GetByOrganizerIdAsync(organizerId);
        var entitlements = await _entitlements.GetOrganizerEntitlementsAsync(organizerId, false);
        return new AdminOrganizerDetailView(
            organizer.Id,
            organizer.Name,
            email?.Email,
            Array.AsReadOnly(oauthAccounts.OrderBy(x => x.Provider).Select(x => new AdminOauthAccountView(
                x.Provider.ToString().ToLowerInvariant(), x.ProviderUserId, x.ProviderUserName)).ToArray()),
            organizer.Role == OrganizerRole.Admin ? "admin" : "organizer",
            organizer.CreatedAt,
            entitlements);
    }

    public async Task<bool> OrganizerExistsAsync(Guid organizerId) => await _organizers.GetByIdAsync(organizerId) is not null;

    public Task<IReadOnlyList<AdminEntitlement>> GetOrganizerEntitlementsAsync(Guid organizerId, bool activeOnly) =>
        _entitlements.GetOrganizerEntitlementsAsync(organizerId, activeOnly);
}
