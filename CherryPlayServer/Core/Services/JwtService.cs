using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core;

namespace CherryPlayServer.Core.Services;

public class JwtService : IJwtService
{
    private readonly string _secretKey;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly TimeSpan _tokenLifetime = TimeSpan.FromDays(AuthConstants.TokenLifetimeDays);

    public JwtService(IConfiguration configuration, IWebHostEnvironment env)
    {
        var secret = configuration["JWT_SECRET_KEY"];
        if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
        {
            if (env.IsDevelopment())
                secret = "dev-secret-key-minimum-32-characters-long-change-in-production";
            else
                throw new InvalidOperationException(
                    "JWT_SECRET_KEY must be set in configuration or environment and be at least 32 characters. " +
                    "Do not use default secrets in production.");
        }
        _secretKey = secret;
        _issuer = configuration["JWT_ISSUER"] ?? "CherryPlayServer";
        _audience = configuration["JWT_AUDIENCE"] ?? "CherryPlayClient";
    }

    public Task<string> GenerateTokenAsync(Guid organizerId, string name, Guid sessionId)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim("organizerId", organizerId.ToString()),
            new Claim("name", name),
            new Claim("sessionId", sessionId.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, sessionId.ToString()),
            new Claim(JwtRegisteredClaimNames.Iat,
                DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
                ClaimValueTypes.Integer64)
        };

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: DateTime.UtcNow.Add(_tokenLifetime),
            signingCredentials: credentials
        );

        var tokenHandler = new JwtSecurityTokenHandler();
        return Task.FromResult(tokenHandler.WriteToken(token));
    }

    public Task<JwtTokenValidationResult> ValidateTokenAsync(string token)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_secretKey);

            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = _issuer,
                ValidateAudience = true,
                ValidAudience = _audience,
                ValidateLifetime = true,
                ClockSkew = AuthConstants.JwtClockSkew
            };

            var principal = tokenHandler.ValidateToken(token, validationParameters, out var validatedToken);
            var organizerIdClaim = principal.FindFirst("organizerId")?.Value;
            var nameClaim = principal.FindFirst("name")?.Value;
            var sessionIdClaim = principal.FindFirst("sessionId")?.Value ?? principal.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;

            if (Guid.TryParse(organizerIdClaim, out var organizerId) && Guid.TryParse(sessionIdClaim, out var sessionId))
            {
                return Task.FromResult(new JwtTokenValidationResult(
                    IsValid: true,
                    OrganizerId: organizerId,
                    SessionId: sessionId,
                    Name: nameClaim,
                    ErrorMessage: null
                ));
            }

            return Task.FromResult(new JwtTokenValidationResult(
                IsValid: false,
                OrganizerId: null,
                SessionId: null,
                Name: null,
                ErrorMessage: "Invalid organizer ID or session ID in token"
            ));
        }
        catch (SecurityTokenExpiredException)
        {
            return Task.FromResult(new JwtTokenValidationResult(
                IsValid: false,
                OrganizerId: null,
                SessionId: null,
                Name: null,
                ErrorMessage: "Token has expired"
            ));
        }
        catch (SecurityTokenException ex)
        {
            return Task.FromResult(new JwtTokenValidationResult(
                IsValid: false,
                OrganizerId: null,
                SessionId: null,
                Name: null,
                ErrorMessage: ex.Message
            ));
        }
        catch (Exception ex)
        {
            return Task.FromResult(new JwtTokenValidationResult(
                IsValid: false,
                OrganizerId: null,
                SessionId: null,
                Name: null,
                ErrorMessage: $"Token validation failed: {ex.Message}"
            ));
        }
    }

    public async Task<Guid?> GetOrganizerIdFromTokenAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var result = await ValidateTokenAsync(token);
        return result.IsValid ? result.OrganizerId : null;
    }
}
