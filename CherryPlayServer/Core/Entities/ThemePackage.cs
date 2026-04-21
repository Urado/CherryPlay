namespace CherryPlayServer.Core.Entities;

public class ThemePackage
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsAutoGranted { get; set; }
    public bool IsActive { get; set; } = true;
    public List<string> ThemeIds { get; set; } = [];
}
