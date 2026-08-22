namespace CherryPlayServer.Core.Entities;

public class DesktopAuthCode
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
