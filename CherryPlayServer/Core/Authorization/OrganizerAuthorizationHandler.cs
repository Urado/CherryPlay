using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using CherryPlayServer.Core.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace CherryPlayServer.Core.Authorization;

public class OrganizerAuthorizationHandler : AuthorizationHandler<OrganizerRequirement>
{
    private readonly IServiceScopeFactory _scopeFactory;

    public OrganizerAuthorizationHandler(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory ?? throw new ArgumentNullException(nameof(scopeFactory));
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        OrganizerRequirement requirement)
    {
        if (context.Resource is HttpContext httpContext)
        {
            if (!httpContext.Items.TryGetValue("OrganizerId", out var organizerId) || organizerId is not Guid)
                return;

            // Проверяем сессию в хранилище: если сессии нет (выход, перезапуск сервера), авторизация не проходит
            if (!httpContext.Items.TryGetValue("SessionId", out var sessionIdObj) || sessionIdObj is not Guid sessionId)
            {
                context.Fail(new AuthorizationFailureReason(this, "Session ID is required"));
                return;
            }

            using var scope = _scopeFactory.CreateScope();
            var sessionRepository = scope.ServiceProvider.GetRequiredService<IOrganizerSessionRepository>();
            var session = await sessionRepository.GetByIdAsync(sessionId);
            if (session == null)
            {
                context.Fail(new AuthorizationFailureReason(this, "Session not found or expired"));
                return;
            }

            if (session.OrganizerId != (Guid)organizerId)
            {
                context.Fail(new AuthorizationFailureReason(this, "Session does not match organizer"));
                return;
            }

            context.Succeed(requirement);
        }
    }
}
