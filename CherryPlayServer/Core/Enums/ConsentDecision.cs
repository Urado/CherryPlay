using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ConsentDecision
{
    [JsonStringEnumMemberName("grant")]
    Grant,

    [JsonStringEnumMemberName("withdraw")]
    Withdraw,

    [JsonStringEnumMemberName("deny")]
    Deny
}
