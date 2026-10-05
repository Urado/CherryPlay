using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Tests;

internal sealed class ValidatedOrganizerSessionRepository(IJwtService jwtService) : IOrganizerSessionRepository
{
    public async Task<OrganizerSession?> GetByIdAsync(Guid sessionId)
    {
        var organizerId = await jwtService.GetOrganizerIdFromTokenAsync("test-session");
        return organizerId.HasValue
            ? new OrganizerSession { Id = sessionId, OrganizerId = organizerId.Value }
            : null;
    }

    public Task<OrganizerSession> AddAsync(OrganizerSession session) => Task.FromResult(session);

    public Task RemoveAsync(Guid sessionId) => Task.CompletedTask;

    public Task RemoveAllByOrganizerIdAsync(Guid organizerId) => Task.CompletedTask;
}
