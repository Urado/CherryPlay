using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Entities;

public class OAuthAccount
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public OAuthProvider Provider { get; set; }
    public string ProviderUserId { get; set; } = string.Empty;
    public string? ProviderUserName { get; set; }
    public string? ProviderUserAvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastUsedAt { get; set; }
}
