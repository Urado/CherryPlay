namespace CherryPlayServer.Core.Options;

/// <summary>Enabled only when consent mutations work (UseInMemoryStorage=true).</summary>
public sealed class ConsentGateOptions
{
    public bool Enabled { get; set; }
}
