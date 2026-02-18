using Microsoft.AspNetCore.Authorization;

namespace CherryPlayServer.Core.Attributes;

public class AuthorizeOrganizerAttribute : AuthorizeAttribute
{
    public AuthorizeOrganizerAttribute()
    {
        Policy = "OrganizerOnly";
    }
}
