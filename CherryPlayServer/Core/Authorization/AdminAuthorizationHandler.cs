using CherryPlayServer.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;

namespace CherryPlayServer.Core.Authorization;

public class AdminAuthorizationHandler : AuthorizationHandler<AdminRequirement>
{
    private readonly IServiceScopeFactory _scopeFactory;

    public AdminAuthorizationHandler(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, AdminRequirement requirement)
    {
        if (context.Resource is not HttpContext httpContext)
        {
            context.Fail(new AuthorizationFailureReason(this, "HTTP context is required"));
            return;
        }

        if (!httpContext.Items.TryGetValue("OrganizerId", out var organizerIdObj) || organizerIdObj is not Guid organizerId)
        {
            context.Fail(new AuthorizationFailureReason(this, "Organizer ID is required"));
            return;
        }

        using var scope = _scopeFactory.CreateScope();
        var organizerRepository = scope.ServiceProvider.GetRequiredService<IOrganizerRepository>();
        var organizer = await organizerRepository.GetByIdAsync(organizerId);
        if (organizer?.Role == Core.Enums.OrganizerRole.Admin)
        {
            context.Succeed(requirement);
            return;
        }

        context.Fail(new AuthorizationFailureReason(this, "Admin role is required"));
    }
}
