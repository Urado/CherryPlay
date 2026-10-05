namespace CherryPlayServer.Core.Entities;

public record AdminOrganizerListItemView(Guid Id, string Name, string? Email, IReadOnlyList<string> OauthProviders, string Role, int ActiveEntitlementsCount, DateTime CreatedAt);
