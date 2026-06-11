namespace CherryPlayServer.Core.Options;



public class PartyDisplayStatusOptions

{

    public const string SectionName = "PartyDisplayStatus";



    public int OrganizerOfflineGraceSeconds { get; set; } = 60;



    public int PlaybackStaleThresholdSeconds { get; set; } = 30;

}


