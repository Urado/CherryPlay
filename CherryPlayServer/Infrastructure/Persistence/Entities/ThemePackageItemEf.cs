namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class ThemePackageItemEf
{
    public Guid PackageId { get; set; }
    public string ThemeId { get; set; } = string.Empty;

    public ThemePackageEf Package { get; set; } = null!;
    public ThemeEf Theme { get; set; } = null!;
}
