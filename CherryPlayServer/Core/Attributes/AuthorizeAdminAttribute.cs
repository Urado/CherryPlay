using Microsoft.AspNetCore.Authorization;

namespace CherryPlayServer.Core.Attributes;

public class AuthorizeAdminAttribute : AuthorizeAttribute
{
    public AuthorizeAdminAttribute()
    {
        Policy = "AdminOnly";
    }
}
