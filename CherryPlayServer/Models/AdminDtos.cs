namespace CherryPlayServer.Models;

public record AdminThemePackageDto(Guid Id, string Code, string Name, bool IsAutoGranted, bool IsActive, List<string> ThemeIds);
public record AdminThemePackageListDto(List<AdminThemePackageDto> Items);
public record AdminOrganizerListItemDto(Guid Id, string Name, string? Email, List<string> OauthProviders, string Role, int ActiveEntitlementsCount, DateTime CreatedAt);
public record AdminOrganizerListDto(List<AdminOrganizerListItemDto> Items, int Total, int Page, int PageSize);
public record AdminOrganizerDetailDto(Guid Id, string Name, string? Email, List<AdminOauthAccountDto> OauthAccounts, string Role, DateTime CreatedAt, List<EntitlementDto> Entitlements);
public record AdminOauthAccountDto(string Provider, string ProviderUserId, string? ProviderUserName);
public record GrantEntitlementRequest(Guid PackageId, [param: System.ComponentModel.DataAnnotations.StringLength(2000)] string? Note);
public record RevokeEntitlementRequest([param: System.ComponentModel.DataAnnotations.StringLength(2000)] string? Note);
public record EntitlementDto(Guid Id, Guid PackageId, string PackageCode, string PackageName, string Kind, string Source, DateTime GrantedAt, DateTime? ExpiresAt, int? UsesRemaining, DateTime? RevokedAt, string? Note);
