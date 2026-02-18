using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Core.Interfaces;

/// <summary>
/// Service for handling authentication business logic.
/// Encapsulates email/password and OAuth authentication flows.
/// </summary>
public interface IAuthService
{
    /// <summary>
    /// Registers a new organizer with email and password.
    /// </summary>
    Task<AuthResult> RegisterAsync(string email, string password, string name);

    /// <summary>
    /// Authenticates an organizer with email and password.
    /// </summary>
    Task<AuthResult> LoginAsync(string email, string password);

    /// <summary>
    /// Processes OAuth callback and returns organizer.
    /// </summary>
    Task<Organizer> ProcessOAuthCallbackAsync(OAuthProvider provider, string code, string redirectUri, string? deviceId = null);

    /// <summary>
    /// Generates JWT token for organizer.
    /// </summary>
    Task<string> GenerateTokenAsync(Organizer organizer);
}

/// <summary>
/// Result of authentication operation.
/// </summary>
public record AuthResult(
    bool Success,
    string? Token,
    Organizer? Organizer,
    string? ErrorMessage
);
