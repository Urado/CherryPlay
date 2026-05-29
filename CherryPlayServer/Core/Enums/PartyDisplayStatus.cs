using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PartyDisplayStatus
{
    [JsonStringEnumMemberName("draft")]
    Draft = 1,

    [JsonStringEnumMemberName("scheduled")]
    Scheduled = 2,

    [JsonStringEnumMemberName("starting_soon")]
    StartingSoon = 3,

    [JsonStringEnumMemberName("live")]
    Live = 4,

    [JsonStringEnumMemberName("organizer_offline")]
    OrganizerOffline = 5,

    [JsonStringEnumMemberName("party_ended")]
    PartyEnded = 6,
}
