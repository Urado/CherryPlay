using CherryPlayServer.Core.Exceptions;
using Microsoft.AspNetCore.Http;

namespace CherryPlayServer.Core.Extensions;

public static class OrganizerExtensions
{
    public static Guid RequireOrganizerId(this HttpContext context)
    {
        var organizerId = context.GetOrganizerId();
        if (!organizerId.HasValue)
        {
            throw new UnauthorizedAccessException("Organizer ID is required");
        }
        return organizerId.Value;
    }

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
