using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Email;

public sealed class UnavailableEmailSender : IEmailSender
{
    public bool IsConfigured => false;

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        throw new InvalidOperationException("Email sending is not configured");
    }
}
