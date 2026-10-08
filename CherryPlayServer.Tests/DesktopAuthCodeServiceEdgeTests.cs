using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;

namespace CherryPlayServer.Tests;

public class DesktopAuthCodeServiceEdgeTests
{
    [Test]
    public async Task Exchange_EmptyOrWhitespace_ReturnsNull()
    {
        var harness = CreateHarness();

        Assert.That(await harness.Service.ExchangeAsync(""), Is.Null);
        Assert.That(await harness.Service.ExchangeAsync("   "), Is.Null);
        Assert.That(await harness.Service.ExchangeAsync("\t\n"), Is.Null);
    }

    [Test]
    public async Task Exchange_OrganizerMissing_ReturnsNull()
    {
        var harness = CreateHarness();
        var missingOrganizerId = Guid.NewGuid();
        var raw = PasswordResetTokenHelper.GenerateRawToken();
        await harness.Repository.AddAsync(new DesktopAuthCode
        {
            Id = Guid.NewGuid(),
            OrganizerId = missingOrganizerId,
            TokenHash = PasswordResetTokenHelper.HashToken(raw),
            ExpiresAt = DateTime.UtcNow.AddMinutes(3),
            CreatedAt = DateTime.UtcNow,
        });

        Assert.That(await harness.Service.ExchangeAsync(raw), Is.Null);
        Assert.That(harness.Auth.GenerateTokenCalls, Is.EqualTo(0));
    }

    private static EdgeHarness CreateHarness()
    {
        var organizers = new InMemoryOrganizerRepository();
        var repository = new InMemoryDesktopAuthCodeRepository();
        var auth = new CountingAuthService();
        var service = new DesktopAuthCodeService(repository, organizers, auth);
        return new EdgeHarness(repository, service, auth);
    }

    private sealed record EdgeHarness(
        InMemoryDesktopAuthCodeRepository Repository,
        DesktopAuthCodeService Service,
        CountingAuthService Auth);

    private sealed class CountingAuthService : IAuthService
    {
        public int GenerateTokenCalls { get; private set; }

        public Task<string> GenerateTokenAsync(Organizer organizer)
        {
            GenerateTokenCalls++;
            return Task.FromResult("jwt");
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
