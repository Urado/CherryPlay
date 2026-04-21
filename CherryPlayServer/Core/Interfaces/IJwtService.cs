namespace CherryPlayServer.Core.Interfaces;

public interface IJwtService
{
    Task<string> GenerateTokenAsync(Guid organizerId, string name, Guid sessionId, string role);
    Task<JwtTokenValidationResult> ValidateTokenAsync(string token);
    Task<Guid?> GetOrganizerIdFromTokenAsync(string token);
}

public record JwtTokenValidationResult(bool IsValid, Guid? OrganizerId, Guid? SessionId, string? Name, string? Role, string? ErrorMessage);
