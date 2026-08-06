using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IOrganizerSessionRepository
{
    Task<OrganizerSession?> GetByIdAsync(Guid sessionId);
    Task<OrganizerSession> AddAsync(OrganizerSession session);
    Task RemoveAsync(Guid sessionId);
    Task RemoveAllByOrganizerIdAsync(Guid organizerId);
}
