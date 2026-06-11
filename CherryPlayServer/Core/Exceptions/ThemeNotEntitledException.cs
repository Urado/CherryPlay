namespace CherryPlayServer.Core.Exceptions;

public class ThemeNotEntitledException : ForbiddenException
{
    public string ThemeId { get; }
    public List<string> RequiredPackageCodes { get; }

    public ThemeNotEntitledException(string themeId, List<string> requiredPackageCodes)
        : base("Theme is not entitled")
    {
        ThemeId = themeId;
        RequiredPackageCodes = requiredPackageCodes;
    }
}
