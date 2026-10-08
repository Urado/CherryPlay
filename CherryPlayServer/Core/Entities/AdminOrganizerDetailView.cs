namespace CherryPlayServer.Core.Entities;

public record AdminOrganizerDetailView(Guid Id, string Name, string? Email, IReadOnlyList<AdminOauthAccountView> OauthAccounts, string Role, DateTime CreatedAt, IReadOnlyList<AdminEntitlement> Entitlements);
