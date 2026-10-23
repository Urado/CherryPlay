using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Tests.IntegrationDb;

public sealed class AdminInterleavingPartyRepository : IPartyRepository
{
    private readonly IPartyRepository _inner;
    public static Func<Guid, Task>? BeforeUpdateAsync { get; set; }

    public AdminInterleavingPartyRepository(AppDbContext db, ILogger<EfPartyRepository> logger)
    {
        _inner = new EfPartyRepository(db, logger);
    }

    public Task<Party?> GetByIdAsync(Guid id) => _inner.GetByIdAsync(id);
    public Task<Party?> GetByShortCodeAsync(string shortCode) => _inner.GetByShortCodeAsync(shortCode);
    public Task<List<Party>> GetAllAsync() => _inner.GetAllAsync();
    public Task<IReadOnlyList<PublicPartyCatalogRecord>> GetAllWithOrganizerNamesAsync() => _inner.GetAllWithOrganizerNamesAsync();
    public Task<List<Party>> GetByOrganizerIdAsync(Guid organizerId) => _inner.GetByOrganizerIdAsync(organizerId);
    public Task<Party> AddAsync(Party party) => _inner.AddAsync(party);
    public Task<bool> AddIfFuturePartyLimitNotReachedAsync(Party party, DateTime nowUtc, int limit) => _inner.AddIfFuturePartyLimitNotReachedAsync(party, nowUtc, limit);

    public async Task UpdateAsync(Party party)
    {
        if (BeforeUpdateAsync is not null)
        {
            await BeforeUpdateAsync(party.Id);
        }
        await _inner.UpdateAsync(party);
    }

    public async Task<bool> UpdateIfFuturePartyLimitNotReachedAsync(Party party, DateTime? previousEventDateTime, DateTime nowUtc, int limit)
    {
        if (BeforeUpdateAsync is not null)
        {
            await BeforeUpdateAsync(party.Id);
        }
        return await _inner.UpdateIfFuturePartyLimitNotReachedAsync(party, previousEventDateTime, nowUtc, limit);
    }

    public Task DeleteAsync(Guid id) => _inner.DeleteAsync(id);
    public Task<Party?> GetFirstAsync() => _inner.GetFirstAsync();
}
