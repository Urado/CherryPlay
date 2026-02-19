namespace CherryPlayServer.Core.Extensions;

public static class HttpContextExtensions
{
    public static Guid? GetOrganizerId(this HttpContext context)
    {
        if (context.Items.TryGetValue("OrganizerId", out var organizerId) && organizerId is Guid id)
        {
            return id;
        }

        return null;
    }

    public static string? GetOrganizerName(this HttpContext context)
    {
        if (context.Items.TryGetValue("OrganizerName", out var name) && name is string organizerName)
        {
            return organizerName;
        }

        return null;
    }

    public static Guid? GetSessionId(this HttpContext context)
    {
        if (context.Items.TryGetValue("SessionId", out var sessionId) && sessionId is Guid id)
        {
            return id;
        }

        return null;
    }
}
