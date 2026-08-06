namespace CherryPlayServer.Core.Entities;

public class PasswordResetToken
{
    public Guid Id { get; set; }
    public Guid EmailAccountId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
