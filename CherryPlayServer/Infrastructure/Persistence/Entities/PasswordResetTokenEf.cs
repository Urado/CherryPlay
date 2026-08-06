namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class PasswordResetTokenEf
{
    public Guid Id { get; set; }
    public Guid EmailAccountId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public EmailAccountEf EmailAccount { get; set; } = null!;
}
