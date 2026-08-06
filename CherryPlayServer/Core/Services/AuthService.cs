using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Options;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Core.Services;

public class AuthService : IAuthService
{
    private readonly IOrganizerRepository _organizerRepository;
    private readonly IOrganizerSessionRepository _sessionRepository;
    private readonly IOAuthAccountRepository _oauthAccountRepository;
    private readonly IEmailAccountRepository _emailAccountRepository;
    private readonly IPasswordResetTokenRepository _passwordResetTokenRepository;
    private readonly IPasswordResetApplicator _passwordResetApplicator;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IOAuthService _oauthService;
    private readonly IJwtService _jwtService;
    private readonly IEmailSender _emailSender;
    private readonly EmailOptions _emailOptions;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IOrganizerRepository organizerRepository,
        IOrganizerSessionRepository sessionRepository,
        IOAuthAccountRepository oauthAccountRepository,
        IEmailAccountRepository emailAccountRepository,
        IPasswordResetTokenRepository passwordResetTokenRepository,
        IPasswordResetApplicator passwordResetApplicator,
        IPasswordHasher passwordHasher,
        IOAuthService oauthService,
        IJwtService jwtService,
        IEmailSender emailSender,
        IOptions<EmailOptions> emailOptions,
        IHostEnvironment environment,
        ILogger<AuthService> logger)
    {
        _organizerRepository = organizerRepository ?? throw new ArgumentNullException(nameof(organizerRepository));
        _sessionRepository = sessionRepository ?? throw new ArgumentNullException(nameof(sessionRepository));
        _oauthAccountRepository = oauthAccountRepository ?? throw new ArgumentNullException(nameof(oauthAccountRepository));
        _emailAccountRepository = emailAccountRepository ?? throw new ArgumentNullException(nameof(emailAccountRepository));
        _passwordResetTokenRepository = passwordResetTokenRepository ?? throw new ArgumentNullException(nameof(passwordResetTokenRepository));
        _passwordResetApplicator = passwordResetApplicator ?? throw new ArgumentNullException(nameof(passwordResetApplicator));
        _passwordHasher = passwordHasher ?? throw new ArgumentNullException(nameof(passwordHasher));
        _oauthService = oauthService ?? throw new ArgumentNullException(nameof(oauthService));
        _jwtService = jwtService ?? throw new ArgumentNullException(nameof(jwtService));
        _emailSender = emailSender ?? throw new ArgumentNullException(nameof(emailSender));
        _emailOptions = emailOptions?.Value ?? throw new ArgumentNullException(nameof(emailOptions));
        _environment = environment ?? throw new ArgumentNullException(nameof(environment));
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
            var passwordValid = _passwordHasher.VerifyPassword(password, hashToVerify);

            if (emailAccount == null || !passwordValid)
            {
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

    public async Task<ForgotPasswordResult> ForgotPasswordAsync(string email)
    {
        if (string.IsNullOrWhiteSpace(email)
            || !System.Text.RegularExpressions.Regex.IsMatch(
                email,
                @"^[^\s@]+@[^\s@]+\.[^\s@]+$",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
        {
            return new ForgotPasswordResult(
                Success: false,
                ServiceUnavailable: false,
                Message: null,
                ErrorMessage: "Некорректный email"
            );
        }

        var publicWebBaseUrl = ResolvePublicWebBaseUrl();
        if (!_environment.IsDevelopment())
        {
            if (!_emailSender.IsConfigured || !_emailOptions.HasPublicWebBaseUrl || string.IsNullOrWhiteSpace(publicWebBaseUrl))
            {
                return new ForgotPasswordResult(
                    Success: false,
                    ServiceUnavailable: true,
                    Message: null,
                    ErrorMessage: AuthConstants.EmailServiceUnavailableMessage
                );
            }
        }
        else if (string.IsNullOrWhiteSpace(publicWebBaseUrl))
        {
            publicWebBaseUrl = "http://localhost:3000";
        }

        string? resetUrlForFallback = null;
        var timingStartedAt = DateTime.UtcNow;

        try
        {
            var emailAccount = await _emailAccountRepository.GetByEmailAsync(email);
            if (emailAccount == null)
            {
                _passwordHasher.VerifyPassword("dummy", AuthConstants.DummyPasswordHash);
                await ApplyForgotPasswordTimingPadAsync(timingStartedAt);
                return ForgotPasswordGenericSuccess();
            }

            await _passwordResetTokenRepository.InvalidateUnusedByEmailAccountIdAsync(emailAccount.Id);

            var rawToken = PasswordResetTokenHelper.GenerateRawToken();
            var resetToken = new PasswordResetToken
            {
                Id = Guid.NewGuid(),
                EmailAccountId = emailAccount.Id,
                TokenHash = PasswordResetTokenHelper.HashToken(rawToken),
                ExpiresAt = DateTime.UtcNow.Add(AuthConstants.PasswordResetTokenTtl),
                CreatedAt = DateTime.UtcNow,
            };
            await _passwordResetTokenRepository.AddAsync(resetToken);

            resetUrlForFallback =
                $"{publicWebBaseUrl.TrimEnd('/')}/reset-password?token={Uri.EscapeDataString(rawToken)}";
            var organizer = await _organizerRepository.GetByIdAsync(emailAccount.OrganizerId);
            var emailMessage = BuildPasswordResetEmail(emailAccount.Email, organizer?.Name, resetUrlForFallback);

            try
            {
                await _emailSender.SendAsync(emailMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to send password reset email; token left usable for account {EmailAccountId}",
                    emailAccount.Id);
                if (_environment.IsDevelopment())
                {
                    _logger.LogInformation(
                        "Password reset link (Dev fallback after send failure): {ResetUrl}",
                        resetUrlForFallback);
                }

                await ApplyForgotPasswordTimingPadAsync(timingStartedAt);
                return ForgotPasswordGenericSuccess();
            }

            await ApplyForgotPasswordTimingPadAsync(timingStartedAt);
            return ForgotPasswordGenericSuccess();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during forgot-password for email: {Email}", email);

            if (_environment.IsDevelopment() && !string.IsNullOrEmpty(resetUrlForFallback))
            {
                _logger.LogInformation(
                    "Password reset link (Dev fallback after unexpected error): {ResetUrl}",
                    resetUrlForFallback);
                await ApplyForgotPasswordTimingPadAsync(timingStartedAt);
                return ForgotPasswordGenericSuccess();
            }

            await ApplyForgotPasswordTimingPadAsync(timingStartedAt);

            if (!_environment.IsDevelopment())
            {
                return new ForgotPasswordResult(
                    Success: false,
                    ServiceUnavailable: true,
                    Message: null,
                    ErrorMessage: AuthConstants.EmailServiceUnavailableMessage
                );
            }

            return new ForgotPasswordResult(
                Success: false,
                ServiceUnavailable: false,
                Message: null,
                ErrorMessage: AuthConstants.EmailServiceUnavailableMessage
            );
        }
    }

    public async Task<PasswordMutationResult> ResetPasswordAsync(string token, string newPassword)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return new PasswordMutationResult(
                Success: false,
                FailureKind: PasswordMutationFailureKind.InvalidToken,
                ErrorMessage: AuthConstants.PasswordResetInvalidTokenMessage
            );
        }

        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < AuthConstants.MinPasswordLength)
        {
            return new PasswordMutationResult(
                Success: false,
                FailureKind: PasswordMutationFailureKind.Validation,
                ErrorMessage: AuthConstants.PasswordTooShortMessage
            );
        }

        try
        {
            var tokenHash = PasswordResetTokenHelper.HashToken(token);
            var resetToken = await _passwordResetTokenRepository.GetValidByTokenHashAsync(tokenHash);
            if (resetToken == null)
            {
                return new PasswordMutationResult(
                    Success: false,
                    FailureKind: PasswordMutationFailureKind.InvalidToken,
                    ErrorMessage: AuthConstants.PasswordResetInvalidTokenMessage
                );
            }

            var emailAccount = await _emailAccountRepository.GetByIdAsync(resetToken.EmailAccountId);
            if (emailAccount == null)
            {
                return new PasswordMutationResult(
                    Success: false,
                    FailureKind: PasswordMutationFailureKind.InvalidToken,
                    ErrorMessage: AuthConstants.PasswordResetInvalidTokenMessage
                );
            }

            var applied = await _passwordResetApplicator.ApplyAsync(
                resetToken.Id,
                emailAccount.Id,
                _passwordHasher.HashPassword(newPassword));
            if (!applied)
            {
                return new PasswordMutationResult(
                    Success: false,
                    FailureKind: PasswordMutationFailureKind.InvalidToken,
                    ErrorMessage: AuthConstants.PasswordResetInvalidTokenMessage
                );
            }

            return new PasswordMutationResult(
                Success: true,
                FailureKind: null,
                ErrorMessage: null
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during reset-password");
            return new PasswordMutationResult(
                Success: false,
                FailureKind: PasswordMutationFailureKind.InvalidToken,
                ErrorMessage: AuthConstants.PasswordResetInvalidTokenMessage
            );
        }
    }

    public async Task<PasswordMutationResult> ChangePasswordAsync(Guid organizerId, string oldPassword, string newPassword)
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < AuthConstants.MinPasswordLength)
        {
            return new PasswordMutationResult(
                Success: false,
                FailureKind: PasswordMutationFailureKind.Validation,
                ErrorMessage: AuthConstants.PasswordTooShortMessage
            );
        }

        if (string.IsNullOrWhiteSpace(oldPassword))
        {
            return new PasswordMutationResult(
                Success: false,
                FailureKind: PasswordMutationFailureKind.Unauthorized,
                ErrorMessage: AuthConstants.WrongCurrentPasswordMessage
            );
        }

        try
        {
            var emailAccount = await _emailAccountRepository.GetByOrganizerIdAsync(organizerId);
            if (emailAccount == null)
            {
                return new PasswordMutationResult(
                    Success: false,
                    FailureKind: PasswordMutationFailureKind.NotAllowed,
                    ErrorMessage: AuthConstants.ChangePasswordOAuthOnlyMessage
                );
            }

            if (!_passwordHasher.VerifyPassword(oldPassword, emailAccount.PasswordHash))
            {
                await Task.Delay(Random.Shared.Next(50, 100));
                return new PasswordMutationResult(
                    Success: false,
                    FailureKind: PasswordMutationFailureKind.Unauthorized,
                    ErrorMessage: AuthConstants.WrongCurrentPasswordMessage
                );
            }

            await _passwordResetApplicator.ApplyPasswordChangeAsync(
                emailAccount.Id,
                organizerId,
                _passwordHasher.HashPassword(newPassword));

            return new PasswordMutationResult(
                Success: true,
                FailureKind: null,
                ErrorMessage: null
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during change-password for organizer {OrganizerId}", organizerId);
            return new PasswordMutationResult(
                Success: false,
                FailureKind: PasswordMutationFailureKind.Validation,
                ErrorMessage: "Не удалось сменить пароль"
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

    public async Task<string> GenerateTokenAsync(Organizer organizer)
    {
        var session = new OrganizerSession
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            CreatedAt = DateTime.UtcNow
        };
        await _sessionRepository.AddAsync(session);
        var role = organizer.Role == OrganizerRole.Admin ? "admin" : "organizer";
        return await _jwtService.GenerateTokenAsync(organizer.Id, organizer.Name, session.Id, role);
    }

    private string? ResolvePublicWebBaseUrl()
    {
        return string.IsNullOrWhiteSpace(_emailOptions.PublicWebBaseUrl)
            ? null
            : _emailOptions.PublicWebBaseUrl.Trim();
    }

    private static ForgotPasswordResult ForgotPasswordGenericSuccess()
    {
        return new ForgotPasswordResult(
            Success: true,
            ServiceUnavailable: false,
            Message: AuthConstants.ForgotPasswordGenericMessage,
            ErrorMessage: null
        );
    }

    private static async Task ApplyForgotPasswordTimingPadAsync(DateTime startedAtUtc)
    {
        const int floorMs = 120;
        var targetMs = floorMs + Random.Shared.Next(0, 40);
        var elapsedMs = (DateTime.UtcNow - startedAtUtc).TotalMilliseconds;
        var remainingMs = (int)Math.Ceiling(targetMs - elapsedMs);
        if (remainingMs > 0)
        {
            await Task.Delay(remainingMs);
        }
    }

    private static EmailMessage BuildPasswordResetEmail(string toEmail, string? toName, string resetUrl)
    {
        var safeResetUrl = System.Net.WebUtility.HtmlEncode(resetUrl);
        var text =
            "Здравствуйте!\n\n" +
            "Вы запросили сброс пароля в CherryPlay.\n" +
            $"Перейдите по ссылке, чтобы задать новый пароль (действует 1 час):\n{resetUrl}\n\n" +
            "Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.";
        var html =
            "<p>Здравствуйте!</p>" +
            "<p>Вы запросили сброс пароля в CherryPlay.</p>" +
            $"<p><a href=\"{safeResetUrl}\">Задать новый пароль</a></p>" +
            "<p>Ссылка действует 1 час.</p>" +
            "<p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>";
        return new EmailMessage(
            ToEmail: toEmail,
            ToName: toName,
            Subject: AuthConstants.PasswordResetEmailSubject,
            HtmlBody: html,
            TextBody: text,
            IdempotencyKey: Guid.NewGuid().ToString("N")
        );
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
