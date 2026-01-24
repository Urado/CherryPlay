using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ThemeId
{
    [JsonPropertyName("cyberpunk")]
    Cyberpunk,
    
    [JsonPropertyName("sakura")]
    Sakura,
    
    [JsonPropertyName("art-deco")]
    ArtDeco
}
