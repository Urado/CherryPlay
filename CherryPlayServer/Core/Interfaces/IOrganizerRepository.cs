using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IOrganizerRepository
{
    Task<Organizer?> GetByIdAsync(Guid id);
    Task<Organizer> AddAsync(Organizer organizer);
    Task UpdateAsync(Organizer organizer);
    Task DeleteAsync(Guid id);
}
