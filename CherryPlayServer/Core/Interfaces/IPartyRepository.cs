using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IPartyRepository
{
    Task<Party?> GetByIdAsync(Guid id);
    Task<Party?> GetByShortCodeAsync(string shortCode);
    Task<List<Party>> GetAllAsync();
    Task<IReadOnlyList<PublicPartyCatalogRecord>> GetAllWithOrganizerNamesAsync();
    Task<List<Party>> GetByOrganizerIdAsync(Guid organizerId);
    Task<Party> AddAsync(Party party);
    Task<bool> AddIfFuturePartyLimitNotReachedAsync(Party party, DateTime nowUtc, int limit);
    Task UpdateAsync(Party party);
    Task<bool> UpdateIfFuturePartyLimitNotReachedAsync(
        Party party,
        DateTime? previousEventDateTime,
        DateTime nowUtc,
        int limit);
    Task DeleteAsync(Guid id);
    Task<Party?> GetFirstAsync();
}
