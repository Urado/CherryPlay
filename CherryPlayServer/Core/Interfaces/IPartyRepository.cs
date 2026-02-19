using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IPartyRepository
{
    Task<Party?> GetByIdAsync(Guid id);
    Task<Party?> GetByShortCodeAsync(string shortCode);
    Task<List<Party>> GetAllAsync();
    Task<List<Party>> GetByOrganizerIdAsync(Guid organizerId);
    Task<Party> AddAsync(Party party);
    Task UpdateAsync(Party party);
    Task DeleteAsync(Guid id);
    Task<Party?> GetFirstAsync();
}
