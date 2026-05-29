using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PartyLifecycleState
{
    [JsonStringEnumMemberName("draft")]
    Draft = 1,

    [JsonStringEnumMemberName("ready")]
    Ready = 2,

    [JsonStringEnumMemberName("completed")]
    Completed = 3,
}
