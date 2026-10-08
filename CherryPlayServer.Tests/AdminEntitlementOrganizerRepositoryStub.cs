using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Tests;

internal sealed class AdminEntitlementOrganizerRepositoryStub(Organizer? organizer) : IOrganizerRepository
{
    public Task<Organizer?> GetByIdAsync(Guid id, bool includeDeleted = false) =>
        Task.FromResult(organizer?.Id == id ? organizer : null);
    public Task<Organizer?> GetByIdForUpdateAsync(Guid id, CancellationToken cancellationToken = default) =>
        GetByIdAsync(id);
    public Task<Organizer> AddAsync(Organizer organizerToAdd) => Task.FromResult(organizerToAdd);
    public Task UpdateAsync(Organizer organizerToUpdate) => Task.CompletedTask;
    public Task DeleteAsync(Guid id) => Task.CompletedTask;
}
