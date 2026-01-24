using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PlaybackStatus
{
    [JsonStringEnumMemberName("idle")]
    Idle,

    [JsonStringEnumMemberName("playing")]
    Playing,

    [JsonStringEnumMemberName("paused")]
    Paused,

    [JsonStringEnumMemberName("ended")]
    Ended
}
