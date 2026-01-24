using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PlayerItemType
{
    [JsonPropertyName("track")]
    Track,
    
    [JsonPropertyName("group")]
    Group
}
