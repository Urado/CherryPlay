using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core;

public static class AdminAuditActionNames
{
    public const string GrantPackage = "grant_package";
    public const string RevokePackage = "revoke_package";

    public static string ToStorageValue(AdminAuditAction action)
    {
        return action switch
        {
            AdminAuditAction.GrantPackage => GrantPackage,
            AdminAuditAction.RevokePackage => RevokePackage,
            _ => throw new ArgumentOutOfRangeException(nameof(action), action, "Unknown admin audit action.")
        };
    }
}
