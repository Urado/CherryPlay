using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum LegalDocumentVersionStatus
{
    [JsonStringEnumMemberName("draft")]
    Draft,

    [JsonStringEnumMemberName("active")]
    Active,

    [JsonStringEnumMemberName("retired")]
    Retired
}
