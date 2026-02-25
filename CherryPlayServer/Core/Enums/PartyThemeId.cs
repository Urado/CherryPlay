using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

/// <summary>
/// PartyTheme идентификатор (см. GLOSSARY.md)
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PartyThemeId
{
    [JsonStringEnumMemberName("cyberpunk")]
    Cyberpunk,

    [JsonStringEnumMemberName("sakura")]
    Sakura,

    [JsonStringEnumMemberName("art-deco")]
    ArtDeco,

    [JsonStringEnumMemberName("basic")]
    Basic,

    [JsonStringEnumMemberName("spring-cross-step")]
    SpringCrossStep
}
