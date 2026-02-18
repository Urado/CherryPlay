using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;

namespace CherryPlayServer.Core.Authorization;

public class OrganizerAuthorizationHandler : AuthorizationHandler<OrganizerRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        OrganizerRequirement requirement)
    {
        if (context.Resource is HttpContext httpContext)
        {
            if (httpContext.Items.TryGetValue("OrganizerId", out var organizerId) && organizerId is Guid)
            {
                context.Succeed(requirement);
            }
        }

        return Task.CompletedTask;
    }
}
