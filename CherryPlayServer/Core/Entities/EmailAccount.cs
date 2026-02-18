namespace CherryPlayServer.Core.Entities;

public class EmailAccount
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastUsedAt { get; set; }
}
