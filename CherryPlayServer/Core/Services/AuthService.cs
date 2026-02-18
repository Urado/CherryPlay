using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using Microsoft.Extensions.Logging;

namespace CherryPlayServer.Core.Services;

public class AuthService : IAuthService
{
    private readonly IOrganizerRepository _organizerRepository;
    private readonly IOAuthAccountRepository _oauthAccountRepository;
    private readonly IEmailAccountRepository _emailAccountRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IOAuthService _oauthService;
    private readonly IJwtService _jwtService;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IOrganizerRepository organizerRepository,
        IOAuthAccountRepository oauthAccountRepository,
        IEmailAccountRepository emailAccountRepository,
        IPasswordHasher passwordHasher,
        IOAuthService oauthService,
        IJwtService jwtService,
        ILogger<AuthService> logger)
    {
        _organizerRepository = organizerRepository ?? throw new ArgumentNullException(nameof(organizerRepository));
        _oauthAccountRepository = oauthAccountRepository ?? throw new ArgumentNullException(nameof(oauthAccountRepository));
        _emailAccountRepository = emailAccountRepository ?? throw new ArgumentNullException(nameof(emailAccountRepository));
        _passwordHasher = passwordHasher ?? throw new ArgumentNullException(nameof(passwordHasher));
        _oauthService = oauthService ?? throw new ArgumentNullException(nameof(oauthService));
        _jwtService = jwtService ?? throw new ArgumentNullException(nameof(jwtService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<AuthResult> RegisterAsync(string email, string password, string name)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(name))
        {
            return new AuthResult(
                Success: false,
                Token: null,
                Organizer: null,
                ErrorMessage: "Email, password and name are required"
            );
        }

        if (!System.Text.RegularExpressions.Regex.IsMatch(email,
                @"^[^\s@]+@[^\s@]+\.[^\s@]+$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
        {
            return new AuthResult(
                Success: false,
                Token: null,
                Organizer: null,
                ErrorMessage: "Invalid email format"
            );
        }

        if (password.Length < AuthConstants.MinPasswordLength)
        {
            return new AuthResult(
                Success: false,
                Token: null,
                Organizer: null,
                ErrorMessage: $"Password must be at least {AuthConstants.MinPasswordLength} characters long"
            );
        }

        var trimmedName = name.Trim();
        if (string.IsNullOrEmpty(trimmedName) || trimmedName.Length > AuthConstants.MaxOrganizerNameLength)
        {
            return new AuthResult(
                Success: false,
                Token: null,
                Organizer: null,
                ErrorMessage: "Name is required and must not exceed " + AuthConstants.MaxOrganizerNameLength + " characters"
            );
        }

        try
        {
            var existingAccount = await _emailAccountRepository.GetByEmailAsync(email);
            if (existingAccount != null)
            {
                return new AuthResult(
                    Success: false,
                    Token: null,
                    Organizer: null,
                    ErrorMessage: "Email is already registered"
                );
            }

            var organizer = new Organizer
            {
                Id = Guid.NewGuid(),
                Name = trimmedName,
                CreatedAt = DateTime.UtcNow
            };
            await _organizerRepository.AddAsync(organizer);

            var emailAccount = new EmailAccount
            {
                Id = Guid.NewGuid(),
                OrganizerId = organizer.Id,
                Email = email.ToLowerInvariant().Trim(),
                PasswordHash = _passwordHasher.HashPassword(password),
                CreatedAt = DateTime.UtcNow,
                LastUsedAt = DateTime.UtcNow
            };
            await _emailAccountRepository.AddAsync(emailAccount);

            var token = await GenerateTokenAsync(organizer);

            return new AuthResult(
                Success: true,
                Token: token,
                Organizer: organizer,
                ErrorMessage: null
            );
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Registration failed: {Message}", ex.Message);
            return new AuthResult(
                Success: false,
                Token: null,
                Organizer: null,
                ErrorMessage: ex.Message
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during registration");
            return new AuthResult(
                Success: false,
                Token: null,
                Organizer: null,
                ErrorMessage: "An error occurred during registration"
            );
        }
    }

    public async Task<AuthResult> LoginAsync(string email, string password)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return new AuthResult(
                Success: false,
                Token: null,
                Organizer: null,
                ErrorMessage: "Email and password are required"
            );
        }

        try
        {
            var emailAccount = await _emailAccountRepository.GetByEmailAsync(email);
            var hashToVerify = emailAccount?.PasswordHash ?? AuthConstants.DummyPasswordHash;

            // Always verify password to prevent timing attacks
            // Use constant-time comparison by always verifying against a hash
            var passwordValid = _passwordHasher.VerifyPassword(password, hashToVerify);

            // Add small delay for failed attempts to prevent timing attacks
            // This ensures similar response time regardless of whether email exists
            if (emailAccount == null || !passwordValid)
            {
                // Small delay to prevent timing attacks (50-100ms)
                await Task.Delay(Random.Shared.Next(50, 100));

                _logger.LogWarning("Failed login attempt for email: {Email}", email);
                return new AuthResult(
                    Success: false,
                    Token: null,
                    Organizer: null,
                    ErrorMessage: AuthConstants.InvalidCredentialsMessage
                );
            }

            var organizer = await _organizerRepository.GetByIdAsync(emailAccount.OrganizerId);
            if (organizer == null)
            {
                _logger.LogWarning("Organizer not found for email account: {Email}", email);
                return new AuthResult(
                    Success: false,
                    Token: null,
                    Organizer: null,
                    ErrorMessage: AuthConstants.InvalidCredentialsMessage
                );
            }

            emailAccount.LastUsedAt = DateTime.UtcNow;
            await _emailAccountRepository.UpdateAsync(emailAccount);

            var token = await GenerateTokenAsync(organizer);

            return new AuthResult(
                Success: true,
                Token: token,
                Organizer: organizer,
                ErrorMessage: null
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login for email: {Email}", email);
            return new AuthResult(
                Success: false,
                Token: null,
                Organizer: null,
                ErrorMessage: AuthConstants.InvalidCredentialsMessage
            );
        }
    }

    public async Task<Organizer> ProcessOAuthCallbackAsync(OAuthProvider provider, string code, string redirectUri, string? deviceId = null)
    {
        OAuthUserInfo userInfo;
        if (provider == OAuthProvider.Vk && !string.IsNullOrEmpty(deviceId))
        {
            userInfo = await _oauthService.ExchangeVkIdCodeAsync(code, deviceId, redirectUri);
        }
        else
        {
            userInfo = await _oauthService.ExchangeCodeAsync(provider, code, redirectUri);
        }

        return await GetOrCreateOrganizerFromOAuthUserInfoAsync(provider, userInfo);
    }

    public Task<string> GenerateTokenAsync(Organizer organizer)
    {
        return _jwtService.GenerateTokenAsync(organizer.Id, organizer.Name);
    }

    private async Task<Organizer> GetOrCreateOrganizerFromOAuthUserInfoAsync(OAuthProvider provider, OAuthUserInfo userInfo)
    {
        var existingAccount = await _oauthAccountRepository.GetByProviderUserIdAsync(provider, userInfo.ProviderUserId);
        if (existingAccount != null)
        {
            existingAccount.LastUsedAt = DateTime.UtcNow;
            existingAccount.ProviderUserName = userInfo.ProviderUserName;
            existingAccount.ProviderUserAvatarUrl = userInfo.ProviderUserAvatarUrl;
            await _oauthAccountRepository.UpdateAsync(existingAccount);
            var organizer = await _organizerRepository.GetByIdAsync(existingAccount.OrganizerId);
            if (organizer != null)
                return organizer;
        }

        var newOrganizer = new Organizer
        {
            Id = Guid.NewGuid(),
            Name = userInfo.ProviderUserName ?? $"User from {provider}",
            CreatedAt = DateTime.UtcNow
        };
        await _organizerRepository.AddAsync(newOrganizer);
        var newAccount = new OAuthAccount
        {
            Id = Guid.NewGuid(),
            OrganizerId = newOrganizer.Id,
            Provider = provider,
            ProviderUserId = userInfo.ProviderUserId,
            ProviderUserName = userInfo.ProviderUserName,
            ProviderUserAvatarUrl = userInfo.ProviderUserAvatarUrl,
            CreatedAt = DateTime.UtcNow,
            LastUsedAt = DateTime.UtcNow
        };
        await _oauthAccountRepository.AddAsync(newAccount);
        return newOrganizer;
    }
}
