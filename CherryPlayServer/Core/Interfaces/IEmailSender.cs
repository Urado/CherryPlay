namespace CherryPlayServer.Core.Interfaces;

public record EmailMessage(
    string ToEmail,
    string? ToName,
    string Subject,
    string HtmlBody,
    string TextBody,
    string? IdempotencyKey = null
);

public interface IEmailSender
{
    bool IsConfigured { get; }
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}
