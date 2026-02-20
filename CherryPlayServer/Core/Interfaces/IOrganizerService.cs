using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IOrganizerService
{
    Task<OrganizerDto?> GetByIdAsync(Guid organizerId);
    Task<OrganizerDto?> UpdateProfileAsync(Guid organizerId, UpdateOrganizerDto dto);
}
