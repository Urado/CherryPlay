using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PlaybackStatus
{
    [JsonPropertyName("idle")]
    Idle,
    
    [JsonPropertyName("playing")]
    Playing,
    
    [JsonPropertyName("paused")]
    Paused,
    
    [JsonPropertyName("ended")]
    Ended
}
