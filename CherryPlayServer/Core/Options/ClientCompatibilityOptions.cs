namespace CherryPlayServer.Core.Options;

public class ClientCompatibilityOptions
{
    public const string SectionName = "ClientCompatibility";

    public string ServerVersion { get; set; } = "0.0.0";

    public DesktopClientCompatibilityOptions Desktop { get; set; } = new();
}
