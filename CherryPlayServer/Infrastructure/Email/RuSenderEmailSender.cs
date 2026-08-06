using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Options;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Infrastructure.Email;

public sealed class RuSenderEmailSender : IEmailSender
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly EmailOptions _options;
    private readonly ILogger<RuSenderEmailSender> _logger;

    public RuSenderEmailSender(
        IHttpClientFactory httpClientFactory,
        IOptions<EmailOptions> options,
        ILogger<RuSenderEmailSender> logger)
    {
        _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
        _options = options?.Value ?? throw new ArgumentNullException(nameof(options));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public bool IsConfigured => _options.IsRuSenderConfigured;

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException("RuSender is not configured");
        }

        var client = _httpClientFactory.CreateClient("RuSender");
        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"api/v1/external-mails/send/{_options.RuSenderSendKeyId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.RuSenderApiToken);
        request.Content = JsonContent.Create(new RuSenderSendRequest
        {
            IdempotencyKey = message.IdempotencyKey,
            Mail = new RuSenderMail
            {
                To = new RuSenderAddress { Email = message.ToEmail, Name = message.ToName },
                From = new RuSenderAddress { Email = _options.FromAddress!, Name = _options.FromName },
                Subject = message.Subject,
                Html = message.HtmlBody,
                Text = message.TextBody,
            },
        });

        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError(
                "RuSender send failed with status {StatusCode}: {Body}",
                (int)response.StatusCode,
                Truncate(body, 500));
            throw new InvalidOperationException($"RuSender send failed with status {(int)response.StatusCode}");
        }
    }

    private static string Truncate(string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
        {
            return value;
        }

        return value[..maxLength];
    }

    private sealed class RuSenderSendRequest
    {
        [JsonPropertyName("idempotencyKey")]
        public string? IdempotencyKey { get; set; }

        [JsonPropertyName("mail")]
        public required RuSenderMail Mail { get; set; }
    }

    private sealed class RuSenderMail
    {
        [JsonPropertyName("to")]
        public required RuSenderAddress To { get; set; }

        [JsonPropertyName("from")]
        public required RuSenderAddress From { get; set; }

        [JsonPropertyName("subject")]
        public required string Subject { get; set; }

        [JsonPropertyName("html")]
        public string? Html { get; set; }

        [JsonPropertyName("text")]
        public string? Text { get; set; }
    }

    private sealed class RuSenderAddress
    {
        [JsonPropertyName("email")]
        public required string Email { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }
    }
}
