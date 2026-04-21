using CherryPlayServer.Core.Authorization;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;

namespace CherryPlayServer.Tests;

public class AdminAuthorizationHandlerTests
{
    [Fact]
    public async Task HandleRequirementAsync_Succeeds_WhenOrganizerRoleInDatabaseIsAdmin()
    {
        var organizerId = Guid.NewGuid();
        var handler = new AdminAuthorizationHandler(CreateScopeFactory(
            new StubOrganizerRepository(new Organizer
            {
                Id = organizerId,
                Name = "Admin user",
                Role = OrganizerRole.Admin
            })));

        var httpContext = new DefaultHttpContext();
        httpContext.Items["OrganizerId"] = organizerId;

        var authContext = new AuthorizationHandlerContext(
            [new AdminRequirement()],
            user: new ClaimsPrincipal(),
            resource: httpContext);

        await handler.HandleAsync(authContext);

        Assert.True(authContext.HasSucceeded);
    }

    [Fact]
    public async Task HandleRequirementAsync_DoesNotSucceed_WhenOrganizerRoleInDatabaseIsNotAdmin()
    {
        var organizerId = Guid.NewGuid();
        var handler = new AdminAuthorizationHandler(CreateScopeFactory(
            new StubOrganizerRepository(new Organizer
            {
                Id = organizerId,
                Name = "Revoked admin",
                Role = OrganizerRole.Organizer
            })));

        var httpContext = new DefaultHttpContext();
        httpContext.Items["OrganizerId"] = organizerId;
        httpContext.Items["OrganizerRole"] = "admin";

        var authContext = new AuthorizationHandlerContext(
            [new AdminRequirement()],
            user: new ClaimsPrincipal(),
            resource: httpContext);

        await handler.HandleAsync(authContext);

        Assert.False(authContext.HasSucceeded);
    }

    private static IServiceScopeFactory CreateScopeFactory(IOrganizerRepository organizerRepository)
    {
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddScoped(_ => organizerRepository);
        return serviceCollection.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>();
    }

    private sealed class StubOrganizerRepository(Organizer? organizer) : IOrganizerRepository
    {
        public Task<Organizer?> GetByIdAsync(Guid id) => Task.FromResult(organizer?.Id == id ? organizer : null);
        public Task<Organizer> AddAsync(Organizer organizerToAdd) => Task.FromResult(organizerToAdd);
        public Task UpdateAsync(Organizer organizerToUpdate) => Task.CompletedTask;
        public Task DeleteAsync(Guid id) => Task.CompletedTask;
    }
}
