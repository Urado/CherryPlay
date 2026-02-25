namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class OAuthAccountEf
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string ProviderUserId { get; set; } = string.Empty;
    public string? ProviderUserName { get; set; }
    public string? ProviderUserAvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }

    public OrganizerEf Organizer { get; set; } = null!;
}
