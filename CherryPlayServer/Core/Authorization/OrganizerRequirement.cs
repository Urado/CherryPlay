using Microsoft.AspNetCore.Authorization;

namespace CherryPlayServer.Core.Authorization;

/// <summary>
/// Requirement для проверки авторизации организатора
/// </summary>
public class OrganizerRequirement : IAuthorizationRequirement
{
}
