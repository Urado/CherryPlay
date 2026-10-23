namespace CherryPlayServer.Core.Options;

public class PartyLimitOptions
{
    public const string SectionName = "PartyLimits";

    public bool EnforceFuturePartyLimit { get; set; } = false;
}
