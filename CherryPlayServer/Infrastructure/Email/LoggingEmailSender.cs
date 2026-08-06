using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Email;

public sealed class LoggingEmailSender : IEmailSender
{
    private readonly ILogger<LoggingEmailSender> _logger;

    public LoggingEmailSender(ILogger<LoggingEmailSender> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public bool IsConfigured => false;

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "Dev email fallback: to={ToEmail}, subject={Subject}, text={TextBody}",
            message.ToEmail,
            message.Subject,
            message.TextBody);
        return Task.CompletedTask;
    }
}
