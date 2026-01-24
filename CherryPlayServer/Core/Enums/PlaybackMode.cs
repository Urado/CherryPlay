using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PlaybackMode
{
    [JsonStringEnumMemberName("preparation")]
    Preparation,

    [JsonStringEnumMemberName("session")]
    Session
}
