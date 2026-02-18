namespace CherryPlayServer.Core.Interfaces;

/// <summary>
/// Service for storing and validating OAuth state parameters to prevent CSRF attacks.
/// </summary>
public interface IOAuthStateService
{
    /// <summary>
    /// Generates and stores a state token for OAuth flow.
    /// </summary>
    /// <param name="provider">OAuth provider name</param>
    /// <returns>State token to be sent to OAuth provider</returns>
    string GenerateAndStoreState(string provider);

    /// <summary>
    /// Validates and consumes a state token.
    /// </summary>
    /// <param name="state">State token received from OAuth provider</param>
    /// <param name="expectedProvider">Expected provider name</param>
    /// <returns>True if state is valid, false otherwise</returns>
    bool ValidateAndConsumeState(string? state, string expectedProvider);
}
