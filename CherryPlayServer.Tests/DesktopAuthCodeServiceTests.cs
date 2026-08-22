using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

public class DesktopAuthCodeServiceTests
{
    [Test]
    public async Task IssueAndExchange_ReturnsJwt()
    {
        var harness = CreateHarness();
        var organizer = await SeedOrganizerAsync(harness);

        var rawCode = await harness.Service.IssueCodeAsync(organizer.Id);
        var token = await harness.Service.ExchangeAsync(rawCode);

        Assert.That(token, Is.EqualTo("jwt-for-" + organizer.Id));
        Assert.That(harness.Sessions.CountByOrganizerId(organizer.Id), Is.EqualTo(1));
    }

    [Test]
    public async Task Exchange_InvalidCode_ReturnsNull()
    {
        var harness = CreateHarness();
        var token = await harness.Service.ExchangeAsync("not-a-valid-code");
        Assert.That(token, Is.Null);
    }

    [Test]
    public async Task Exchange_UsedCode_ReturnsNull()
    {
        var harness = CreateHarness();
        var organizer = await SeedOrganizerAsync(harness);
        var rawCode = await harness.Service.IssueCodeAsync(organizer.Id);

        Assert.That(await harness.Service.ExchangeAsync(rawCode), Is.Not.Null);
        Assert.That(await harness.Service.ExchangeAsync(rawCode), Is.Null);
    }

    [Test]
    public async Task Exchange_ExpiredCode_ReturnsNull()
    {
        var harness = CreateHarness();
        var organizer = await SeedOrganizerAsync(harness);
        var raw = PasswordResetTokenHelper.GenerateRawToken();
        await harness.Repository.AddAsync(new DesktopAuthCode
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            TokenHash = PasswordResetTokenHelper.HashToken(raw),
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1),
            CreatedAt = DateTime.UtcNow.AddMinutes(-4),
        });

        Assert.That(await harness.Service.ExchangeAsync(raw), Is.Null);
    }

    [Test]
    public async Task IssueCode_UsesConfiguredTtl()
    {
        var harness = CreateHarness();
        var organizer = await SeedOrganizerAsync(harness);

        var rawCode = await harness.Service.IssueCodeAsync(organizer.Id);
        var hash = PasswordResetTokenHelper.HashToken(rawCode);
        var stored = await harness.Repository.GetValidByTokenHashAsync(hash);

        Assert.That(stored, Is.Not.Null);
        Assert.That(stored!.ExpiresAt - stored.CreatedAt, Is.EqualTo(AuthConstants.DesktopAuthCodeTtl).Within(TimeSpan.FromSeconds(1)));
    }

    private static DesktopAuthHarness CreateHarness()
    {
        var organizers = new InMemoryOrganizerRepository();
        var repository = new InMemoryDesktopAuthCodeRepository();
        var sessions = new DesktopAuthSessionRepository();
        var authService = new StubAuthForDesktopExchange(sessions);
        var service = new DesktopAuthCodeService(
            repository,
            organizers,
            authService);

        return new DesktopAuthHarness(organizers, repository, sessions, service);
    }

    private static async Task<Organizer> SeedOrganizerAsync(DesktopAuthHarness harness)
    {
        var organizer = new Organizer
        {
            Id = Guid.NewGuid(),
            Name = "Desktop User",
            CreatedAt = DateTime.UtcNow,
        };
        await harness.Organizers.AddAsync(organizer);
        return organizer;
    }

    private sealed record DesktopAuthHarness(
        InMemoryOrganizerRepository Organizers,
        InMemoryDesktopAuthCodeRepository Repository,
        DesktopAuthSessionRepository Sessions,
        DesktopAuthCodeService Service);

    private sealed class DesktopAuthSessionRepository : IOrganizerSessionRepository
    {
        private readonly List<OrganizerSession> _sessions = [];

        public int CountByOrganizerId(Guid organizerId) =>
            _sessions.Count(s => s.OrganizerId == organizerId);

        public Task<OrganizerSession?> GetByIdAsync(Guid sessionId) =>
            Task.FromResult(_sessions.FirstOrDefault(s => s.Id == sessionId));

        public Task<OrganizerSession> AddAsync(OrganizerSession session)
        {
            _sessions.Add(session);
            return Task.FromResult(session);
        }

        public Task RemoveAsync(Guid sessionId)
        {
            _sessions.RemoveAll(s => s.Id == sessionId);
            return Task.CompletedTask;
        }

        public Task RemoveAllByOrganizerIdAsync(Guid organizerId)
        {
            _sessions.RemoveAll(s => s.OrganizerId == organizerId);
            return Task.CompletedTask;
        }
    }

    private sealed class StubAuthForDesktopExchange(
        DesktopAuthSessionRepository sessions) : IAuthService
    {
        public Task<string> GenerateTokenAsync(Organizer organizer)
        {
            return sessions.AddAsync(new OrganizerSession
            {
                Id = Guid.NewGuid(),
                OrganizerId = organizer.Id,
                CreatedAt = DateTime.UtcNow,
            }).ContinueWith(_ => "jwt-for-" + organizer.Id);
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
