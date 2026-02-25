namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class EmailAccountEf
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }

    public OrganizerEf Organizer { get; set; } = null!;
}
