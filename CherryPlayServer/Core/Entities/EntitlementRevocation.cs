namespace CherryPlayServer.Core.Entities;

public record EntitlementRevocation(Guid Id, Guid? EntitlementId, Guid AdminId, string? Note, DateTime CreatedAt);
