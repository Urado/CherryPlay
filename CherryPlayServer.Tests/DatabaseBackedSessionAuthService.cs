using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Tests;

internal sealed class DatabaseBackedSessionAuthService(IOrganizerSessionRepository sessions) : IAuthService
{
    public async Task<string> GenerateTokenAsync(Organizer organizer)
    {
        var session = new OrganizerSession
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            CreatedAt = DateTime.UtcNow
        };
        await sessions.AddAsync(session);
        return $"jwt:{session.Id:N}";
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

    public Task<PasswordMutationResult> ChangePasswordAsync(Guid organizerId, string oldPassword, string newPassword) =>
        throw new NotSupportedException();
}
