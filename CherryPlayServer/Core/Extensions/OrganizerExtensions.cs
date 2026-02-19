using CherryPlayServer.Core.Exceptions;
using Microsoft.AspNetCore.Http;

namespace CherryPlayServer.Core.Extensions;

public static class OrganizerExtensions
{
    /// <summary>
    /// Получает organizerId из HttpContext или выбрасывает UnauthorizedAccessException.
    /// </summary>
    public static Guid RequireOrganizerId(this HttpContext context)
    {
        var organizerId = context.GetOrganizerId();
        if (!organizerId.HasValue)
        {
            throw new UnauthorizedAccessException("Organizer ID is required");
        }
        return organizerId.Value;
    }

    /// <summary>
    /// Получает organizerId из HttpContext или выбрасывает UnauthorizedAccessException с кастомным сообщением.
    /// </summary>
    public static Guid RequireOrganizerId(this HttpContext context, string operation)
    {
        var organizerId = context.GetOrganizerId();
        if (!organizerId.HasValue)
        {
            throw new UnauthorizedAccessException($"Organizer ID is required to {operation}");
        }
        return organizerId.Value;
    }
}
