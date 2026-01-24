using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PlayerItemType
{
    [JsonStringEnumMemberName("track")]
    Track,
    
    [JsonStringEnumMemberName("group")]
    Group
}
