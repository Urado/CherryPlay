namespace CherryPlayServer.Core.Options;

public class ClientCompatibilityOptions
{
    public const string SectionName = "ClientCompatibility";

    /// <summary>Server release version; web client must match exactly.</summary>
    public string ServerVersion { get; set; } = "0.0.0";

    public DesktopClientCompatibilityOptions Desktop { get; set; } = new();
}

public class DesktopClientCompatibilityOptions
{
    /// <summary>Minimum supported CherryPlayList (desktop) major.minor version (patch is ignored).</summary>
    public string MinVersion { get; set; } = "0.0.0";
}
