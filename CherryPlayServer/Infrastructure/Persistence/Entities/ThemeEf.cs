namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class ThemeEf
{
    public string ThemeId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Visibility { get; set; } = "public";

    public ICollection<ThemePackageItemEf> PackageItems { get; set; } = [];
}
