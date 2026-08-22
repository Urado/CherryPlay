namespace CherryPlayServer.Core.Interfaces;

public record OAuthStateConsumeResult(string? Client, string? ReturnTo = null);

public interface IOAuthStateService
{
    string GenerateAndStoreState(string provider, string? client = null, string? returnTo = null);

    bool ValidateAndConsumeState(string? state, string expectedProvider);

    OAuthStateConsumeResult? ValidateAndConsumeStateWithClient(string? state, string expectedProvider)
    {
        return ValidateAndConsumeState(state, expectedProvider)
            ? new OAuthStateConsumeResult(null)
            : null;
    }
}
