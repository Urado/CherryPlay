using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PlaybackMode
{
    [JsonPropertyName("preparation")]
    Preparation,
    
    [JsonPropertyName("session")]
    Session
}
