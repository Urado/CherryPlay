namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class ThemePackageEf
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsAutoGranted { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<ThemePackageItemEf> Items { get; set; } = [];
}
