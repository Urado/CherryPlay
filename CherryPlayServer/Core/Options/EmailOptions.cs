namespace CherryPlayServer.Core.Options;

public class EmailOptions
{
    public string? RuSenderApiToken { get; set; }
    public string? RuSenderSendKeyId { get; set; }
    public string? FromAddress { get; set; }
    public string FromName { get; set; } = "CherryPlay";
    public string? PublicWebBaseUrl { get; set; }

    public bool IsRuSenderConfigured =>
        !string.IsNullOrWhiteSpace(RuSenderApiToken)
        && !string.IsNullOrWhiteSpace(RuSenderSendKeyId)
        && !string.IsNullOrWhiteSpace(FromAddress);

    public bool HasPublicWebBaseUrl => !string.IsNullOrWhiteSpace(PublicWebBaseUrl);
}
