using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Core.Authorization;

public class OrganizerAuthorizationHandler : AuthorizationHandler<OrganizerRequirement>
{
    private readonly IOrganizerSessionRepository _sessionRepository;

    public OrganizerAuthorizationHandler(IOrganizerSessionRepository sessionRepository)
    {
        _sessionRepository = sessionRepository ?? throw new ArgumentNullException(nameof(sessionRepository));
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

            var session = await _sessionRepository.GetByIdAsync(sessionId);
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
