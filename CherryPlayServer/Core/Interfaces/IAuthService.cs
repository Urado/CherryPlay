using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(string email, string password, string name);
    Task<AuthResult> LoginAsync(string email, string password);
    Task<Organizer> ProcessOAuthCallbackAsync(OAuthProvider provider, string code, string redirectUri, string? deviceId = null);
    Task<string> GenerateTokenAsync(Organizer organizer);
    Task<ForgotPasswordResult> ForgotPasswordAsync(string email);
    Task<PasswordMutationResult> ResetPasswordAsync(string token, string newPassword);
    Task<PasswordMutationResult> ChangePasswordAsync(Guid organizerId, string oldPassword, string newPassword);
}

public record AuthResult(
    bool Success,
    string? Token,
    Organizer? Organizer,
    string? ErrorMessage
);

public record ForgotPasswordResult(
    bool Success,
    bool ServiceUnavailable,
    string? Message,
    string? ErrorMessage
);

public enum PasswordMutationFailureKind
{
    Validation,
    InvalidToken,
    Unauthorized,
    NotAllowed,
}

public record PasswordMutationResult(
    bool Success,
    PasswordMutationFailureKind? FailureKind,
    string? ErrorMessage
);
