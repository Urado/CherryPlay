using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ThemeId
{
    [JsonStringEnumMemberName("cyberpunk")]
    Cyberpunk,

    [JsonStringEnumMemberName("sakura")]
    Sakura,

    [JsonStringEnumMemberName("art-deco")]
    ArtDeco,

    [JsonStringEnumMemberName("basic")]
    Basic
}
