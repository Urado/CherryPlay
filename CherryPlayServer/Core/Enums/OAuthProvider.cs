using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum OAuthProvider
{
    [JsonStringEnumMemberName("telegram")]
    Telegram,

    [JsonStringEnumMemberName("vk")]
    Vk,

    [JsonStringEnumMemberName("mailru")]
    MailRu
}
