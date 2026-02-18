namespace CherryPlayServer.Core.Interfaces;

public interface IJwtService
{
    Task<string> GenerateTokenAsync(Guid organizerId, string name);
    Task<JwtTokenValidationResult> ValidateTokenAsync(string token);
    Task<Guid?> GetOrganizerIdFromTokenAsync(string token);
}

public record JwtTokenValidationResult(bool IsValid, Guid? OrganizerId, string? Name, string? ErrorMessage);
