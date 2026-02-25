namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class OrganizerSessionEf
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public DateTime CreatedAt { get; set; }

    public OrganizerEf Organizer { get; set; } = null!;
}
