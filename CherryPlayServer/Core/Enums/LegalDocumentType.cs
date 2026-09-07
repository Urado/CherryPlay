using System.Text.Json.Serialization;

namespace CherryPlayServer.Core.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum LegalDocumentType
{
    [JsonStringEnumMemberName("pd_consent_text")]
    PdConsentText,

    [JsonStringEnumMemberName("terms")]
    Terms,

    [JsonStringEnumMemberName("privacy_policy")]
    PrivacyPolicy,

    [JsonStringEnumMemberName("cookie_policy")]
    CookiePolicy
}
