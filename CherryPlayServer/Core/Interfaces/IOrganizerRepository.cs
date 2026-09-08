using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IOrganizerRepository
{
    Task<Organizer?> GetByIdAsync(Guid id, bool includeDeleted = false);
    Task<Organizer?> GetByIdForUpdateAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Organizer> AddAsync(Organizer organizer);
    Task UpdateAsync(Organizer organizer);
    Task DeleteAsync(Guid id);
}
