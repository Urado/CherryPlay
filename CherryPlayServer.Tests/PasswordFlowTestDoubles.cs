using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Options;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using System.Collections.Concurrent;

namespace CherryPlayServer.Tests;

internal sealed class PasswordFlowHarness
{
    public InMemoryOrganizerRepository Organizers { get; } = new();
    public InMemoryEmailAccountRepository EmailAccounts { get; } = new();
    public TestOrganizerSessionRepository Sessions { get; } = new();
    public TestPasswordResetTokenRepository ResetTokens { get; } = new();
    public FastPasswordHasher PasswordHasher { get; } = new();
    public IEmailSender EmailSender { get; }
    public RecordingEmailSender? RecordingSender => EmailSender as RecordingEmailSender;
    public EmailOptions EmailOptions { get; }
    public FakeHostEnvironment Environment { get; }
    public AuthService AuthService { get; }

    public PasswordFlowHarness(
        string environmentName,
        bool emailConfigured = true,
        string? publicWebBaseUrl = "https://web.example",
        IEmailSender? emailSender = null,
        Exception? sendException = null)
    {
        Environment = new FakeHostEnvironment(environmentName);
        EmailOptions = new EmailOptions
        {
            PublicWebBaseUrl = publicWebBaseUrl,
            RuSenderApiToken = emailConfigured ? "token" : null,
            RuSenderSendKeyId = emailConfigured ? "key" : null,
            FromAddress = emailConfigured ? "noreply@example.com" : null,
        };

        if (emailSender != null)
        {
            EmailSender = emailSender;
        }
        else if (sendException != null)
        {
            EmailSender = new ThrowingRecordingEmailSender(sendException, isConfigured: emailConfigured);
        }
        else
        {
            EmailSender = new RecordingEmailSender(isConfigured: emailConfigured);
        }

        var applicator = new InMemoryPasswordResetApplicator(ResetTokens, EmailAccounts, Sessions);

        AuthService = new AuthService(
            Organizers,
            Sessions,
            new UnusedOAuthAccountRepository(),
            EmailAccounts,
            ResetTokens,
            applicator,
            PasswordHasher,
            new UnusedOAuthService(),
            new UnusedJwtService(),
            EmailSender,
            Options.Create(EmailOptions),
            Environment,
            NullLogger<AuthService>.Instance);
    }

    public static PasswordFlowHarness Dev(
        bool emailConfigured = false,
        string? publicWebBaseUrl = "https://web.example",
        IEmailSender? emailSender = null,
        Exception? sendException = null) =>
        new(Environments.Development, emailConfigured, publicWebBaseUrl, emailSender, sendException);

    public static PasswordFlowHarness Prod(
        bool emailConfigured = true,
        string? publicWebBaseUrl = "https://web.example",
        IEmailSender? emailSender = null,
        Exception? sendException = null) =>
        new(Environments.Production, emailConfigured, publicWebBaseUrl, emailSender, sendException);

    public async Task<(Organizer Organizer, EmailAccount Account)> SeedEmailAccountAsync(
        string email = "user@example.com",
        string password = "secret1",
        string name = "Test User")
    {
        var organizer = new Organizer
        {
            Id = Guid.NewGuid(),
            Name = name,
            CreatedAt = DateTime.UtcNow,
        };
        await Organizers.AddAsync(organizer);

        var account = new EmailAccount
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            Email = email.ToLowerInvariant().Trim(),
            PasswordHash = PasswordHasher.HashPassword(password),
            CreatedAt = DateTime.UtcNow,
            LastUsedAt = DateTime.UtcNow,
        };
        await EmailAccounts.AddAsync(account);
        return (organizer, account);
    }

    public static string? ExtractRawTokenFromResetUrl(string? textOrUrl)
    {
        if (string.IsNullOrWhiteSpace(textOrUrl))
        {
            return null;
        }

        const string marker = "token=";
        var index = textOrUrl.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (index < 0)
        {
            return null;
        }

        var start = index + marker.Length;
        var end = textOrUrl.IndexOfAny([' ', '\n', '\r', '"', '&', '<'], start);
        var raw = end < 0 ? textOrUrl[start..] : textOrUrl[start..end];
        return Uri.UnescapeDataString(raw.Trim());
    }
}

internal sealed class TestOrganizerSessionRepository : IOrganizerSessionRepository
{
    private readonly ConcurrentDictionary<Guid, OrganizerSession> _sessions = new();

    public IReadOnlyCollection<OrganizerSession> All => _sessions.Values.ToArray();

    public int CountByOrganizerId(Guid organizerId) =>
        _sessions.Values.Count(s => s.OrganizerId == organizerId);

    public Task<OrganizerSession?> GetByIdAsync(Guid sessionId)
    {
        _sessions.TryGetValue(sessionId, out var session);
        return Task.FromResult(session);
    }

    public Task<OrganizerSession> AddAsync(OrganizerSession session)
    {
        _sessions[session.Id] = session;
        return Task.FromResult(session);
    }

    public Task RemoveAsync(Guid sessionId)
    {
        _sessions.TryRemove(sessionId, out _);
        return Task.CompletedTask;
    }

    public Task RemoveAllByOrganizerIdAsync(Guid organizerId)
    {
        foreach (var id in _sessions.Where(kv => kv.Value.OrganizerId == organizerId).Select(kv => kv.Key).ToList())
        {
            _sessions.TryRemove(id, out _);
        }

        return Task.CompletedTask;
    }
}

internal sealed class TestPasswordResetTokenRepository : IPasswordResetTokenRepository
{
    private readonly ConcurrentDictionary<Guid, PasswordResetToken> _tokens = new();

    public IReadOnlyCollection<PasswordResetToken> All =>
        _tokens.Values.Select(Clone).ToArray();

    public Task<PasswordResetToken> AddAsync(PasswordResetToken token)
    {
        _tokens[token.Id] = Clone(token);
        return Task.FromResult(Clone(token));
    }

    public Task<PasswordResetToken?> GetValidByTokenHashAsync(string tokenHash)
    {
        var now = DateTime.UtcNow;
        var match = _tokens.Values.FirstOrDefault(t =>
            t.TokenHash == tokenHash
            && t.UsedAt == null
            && t.ExpiresAt > now);
        return Task.FromResult(match is null ? null : Clone(match));
    }

    public Task InvalidateUnusedByEmailAccountIdAsync(Guid emailAccountId)
    {
        var now = DateTime.UtcNow;
        foreach (var token in _tokens.Values.Where(t => t.EmailAccountId == emailAccountId && t.UsedAt == null))
        {
            token.UsedAt = now;
        }

        return Task.CompletedTask;
    }

    public Task<bool> TryMarkUsedAsync(Guid tokenId)
    {
        if (!_tokens.TryGetValue(tokenId, out var token))
        {
            return Task.FromResult(false);
        }

        var now = DateTime.UtcNow;
        if (token.UsedAt != null || token.ExpiresAt <= now)
        {
            return Task.FromResult(false);
        }

        token.UsedAt = now;
        return Task.FromResult(true);
    }

    public Task<bool> TryUnmarkUsedAsync(Guid tokenId)
    {
        if (!_tokens.TryGetValue(tokenId, out var token) || token.UsedAt == null)
        {
            return Task.FromResult(false);
        }

        token.UsedAt = null;
        return Task.FromResult(true);
    }

    private static PasswordResetToken Clone(PasswordResetToken token)
    {
        return new PasswordResetToken
        {
            Id = token.Id,
            EmailAccountId = token.EmailAccountId,
            TokenHash = token.TokenHash,
            ExpiresAt = token.ExpiresAt,
            UsedAt = token.UsedAt,
            CreatedAt = token.CreatedAt,
        };
    }
}

internal class RecordingEmailSender(bool isConfigured = true) : IEmailSender
{
    public bool IsConfigured { get; } = isConfigured;
    public List<EmailMessage> Sent { get; } = [];

    public virtual Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        Sent.Add(message);
        return Task.CompletedTask;
    }
}

internal sealed class ThrowingRecordingEmailSender(Exception exception, bool isConfigured = true)
    : RecordingEmailSender(isConfigured)
{
    public override Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        Sent.Add(message);
        throw exception;
    }
}

internal sealed class FastPasswordHasher : IPasswordHasher
{
    public string HashPassword(string password) => $"hash:{password}";

    public bool VerifyPassword(string password, string hash)
    {
        if (string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(hash))
        {
            return false;
        }

        return hash == $"hash:{password}";
    }
}

internal sealed class FakeHostEnvironment(string environmentName) : IHostEnvironment
{
    public string EnvironmentName { get; set; } = environmentName;
    public string ApplicationName { get; set; } = "CherryPlayServer.Tests";
    public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}

internal sealed class UnusedOAuthAccountRepository : IOAuthAccountRepository
{
    public Task<OAuthAccount?> GetByProviderUserIdAsync(OAuthProvider provider, string providerUserId) =>
        Task.FromResult<OAuthAccount?>(null);

    public Task<List<OAuthAccount>> GetByOrganizerIdAsync(Guid organizerId) =>
        Task.FromResult(new List<OAuthAccount>());

    public Task<OAuthAccount> AddAsync(OAuthAccount account) => Task.FromResult(account);
    public Task UpdateAsync(OAuthAccount account) => Task.CompletedTask;
    public Task DeleteAsync(Guid id) => Task.CompletedTask;
}

internal sealed class UnusedOAuthService : IOAuthService
{
    public Task<string> GetAuthorizationUrlAsync(OAuthProvider provider, string redirectUri, string? state = null) =>
        Task.FromResult("https://example/oauth");

    public Task<OAuthUserInfo> ExchangeCodeAsync(OAuthProvider provider, string code, string redirectUri) =>
        throw new NotSupportedException();

    public Task<OAuthUserInfo> ExchangeVkIdCodeAsync(string code, string deviceId, string redirectUri) =>
        throw new NotSupportedException();
}

internal sealed class UnusedJwtService : IJwtService
{
    public Task<string> GenerateTokenAsync(Guid organizerId, string name, Guid sessionId, string role) =>
        Task.FromResult("jwt");

    public Task<JwtTokenValidationResult> ValidateTokenAsync(string token) =>
        Task.FromResult(new JwtTokenValidationResult(false, null, null, null, null, "unused"));

    public Task<Guid?> GetOrganizerIdFromTokenAsync(string token) => Task.FromResult<Guid?>(null);
}
