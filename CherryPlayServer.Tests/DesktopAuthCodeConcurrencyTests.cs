using System.Collections.Concurrent;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;

namespace CherryPlayServer.Tests;

public class DesktopAuthCodeConcurrencyTests
{
    [Test]
    public async Task TryMarkUsedAsync_ConcurrentCalls_OnlyOneSucceeds()
    {
        var repo = new InMemoryDesktopAuthCodeRepository();
        var code = new DesktopAuthCode
        {
            Id = Guid.NewGuid(),
            OrganizerId = Guid.NewGuid(),
            TokenHash = PasswordResetTokenHelper.HashToken("concurrent"),
            ExpiresAt = DateTime.UtcNow.AddMinutes(3),
            CreatedAt = DateTime.UtcNow,
        };
        await repo.AddAsync(code);

        var winners = 0;
        await Task.WhenAll(Enumerable.Range(0, 32).Select(async _ =>
        {
            if (await repo.TryMarkUsedAsync(code.Id))
            {
                Interlocked.Increment(ref winners);
            }
        }));

        Assert.That(winners, Is.EqualTo(1));
        Assert.That(await repo.GetValidByTokenHashAsync(code.TokenHash), Is.Null);
    }

    [Test]
    public async Task ExchangeAsync_ConcurrentDoubleExchange_OnlyOneJwt()
    {
        var organizers = new InMemoryOrganizerRepository();
        var repository = new InMemoryDesktopAuthCodeRepository();
        var sessions = new CountingSessionRepository();
        var auth = new TokenAuthService(sessions);
        var service = new DesktopAuthCodeService(repository, organizers, auth);

        var organizer = new Organizer
        {
            Id = Guid.NewGuid(),
            Name = "Concurrent",
            CreatedAt = DateTime.UtcNow,
        };
        await organizers.AddAsync(organizer);
        var rawCode = await service.IssueCodeAsync(organizer.Id);

        var tokens = new ConcurrentBag<string?>();
        await Task.WhenAll(Enumerable.Range(0, 24).Select(async _ =>
        {
            tokens.Add(await service.ExchangeAsync(rawCode));
        }));

        var success = tokens.Count(t => t != null);
        Assert.That(success, Is.EqualTo(1));
        Assert.That(sessions.Count, Is.EqualTo(1));
    }

    private sealed class CountingSessionRepository : IOrganizerSessionRepository
    {
        private int _count;
        public int Count => _count;

        public Task<OrganizerSession?> GetByIdAsync(Guid sessionId) =>
            Task.FromResult<OrganizerSession?>(null);

        public Task<OrganizerSession> AddAsync(OrganizerSession session)
        {
            Interlocked.Increment(ref _count);
            return Task.FromResult(session);
        }

        public Task RemoveAsync(Guid sessionId) => Task.CompletedTask;

        public Task RemoveAllByOrganizerIdAsync(Guid organizerId) => Task.CompletedTask;
    }

    private sealed class TokenAuthService(CountingSessionRepository sessions) : IAuthService
    {
        public Task<string> GenerateTokenAsync(Organizer organizer)
        {
            return sessions.AddAsync(new OrganizerSession
            {
                Id = Guid.NewGuid(),
                OrganizerId = organizer.Id,
                CreatedAt = DateTime.UtcNow,
            }).ContinueWith(_ => "jwt-" + organizer.Id);
        }

        public Task<AuthResult> RegisterAsync(string email, string password, string name, bool issueToken = true) =>
            throw new NotSupportedException();

        public Task<AuthResult> LoginAsync(string email, string password, bool issueToken = true) =>
            throw new NotSupportedException();

        public Task<Organizer> ProcessOAuthCallbackAsync(
            OAuthProvider provider,
            string code,
            string redirectUri,
            string? deviceId = null) =>
            throw new NotSupportedException();

        public Task<ForgotPasswordResult> ForgotPasswordAsync(string email) =>
            throw new NotSupportedException();

        public Task<PasswordMutationResult> ResetPasswordAsync(string token, string newPassword) =>
            throw new NotSupportedException();

        public Task<PasswordMutationResult> ChangePasswordAsync(
            Guid organizerId,
            string oldPassword,
            string newPassword) =>
            throw new NotSupportedException();
    }
}
