using System.Web;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core;
using CherryPlayServer.Models;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("auth")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IOAuthService _oauthService;
    private readonly IOAuthStateService _oauthStateService;
    private readonly IOrganizerSessionRepository _sessionRepository;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IAuthService authService,
        IOAuthService oauthService,
        IOAuthStateService oauthStateService,
        IOrganizerSessionRepository sessionRepository,
        IConfiguration configuration,
        ILogger<AuthController> logger)
    {
        _authService = authService ?? throw new ArgumentNullException(nameof(authService));
        _oauthService = oauthService ?? throw new ArgumentNullException(nameof(oauthService));
        _oauthStateService = oauthStateService ?? throw new ArgumentNullException(nameof(oauthStateService));
        _sessionRepository = sessionRepository ?? throw new ArgumentNullException(nameof(sessionRepository));
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpGet("{provider}/start")]
    public async Task<IActionResult> StartDesktopAuth(string provider, [FromQuery] string? redirectUri = null)
    {
        if (!Enum.TryParse<OAuthProvider>(provider, true, out var oauthProvider))
        {
            return BadRequest($"Unsupported provider: {provider}");
        }

        try
        {
            var finalRedirectUri = redirectUri ?? "cherryplaylist://auth";
            if (!IsAllowedRedirectUri(finalRedirectUri, forDesktop: true))
            {
                _logger.LogWarning("Rejected OAuth redirect URI: {RedirectUri}", finalRedirectUri);
                return BadRequest("Invalid redirect URI");
            }
            var state = _oauthStateService.GenerateAndStoreState(provider);

            _logger.LogInformation("Starting desktop OAuth flow: provider={Provider}, redirectUri={RedirectUri}",
                provider, finalRedirectUri);

            var authUrl = await _oauthService.GetAuthorizationUrlAsync(oauthProvider, finalRedirectUri, state);

            _logger.LogInformation("OAuth authorization URL generated: {AuthUrl}", authUrl);
            return Redirect(authUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting OAuth flow for provider: {Provider}", provider);
            return StatusCode(500, "An error occurred while starting authentication");
        }
    }

    [HttpGet("{provider}/web")]
    public async Task<IActionResult> StartWebAuth(string provider)
    {
        if (!Enum.TryParse<OAuthProvider>(provider, true, out var oauthProvider))
        {
            return BadRequest($"Unsupported provider: {provider}");
        }

        try
        {
            var redirectUri = GetWebRedirectUri(provider);
            var state = _oauthStateService.GenerateAndStoreState(provider);
            var authUrl = await _oauthService.GetAuthorizationUrlAsync(oauthProvider, redirectUri, state);

            return Redirect(authUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting OAuth flow for provider: {Provider}", provider);
            return StatusCode(500, "An error occurred while starting authentication");
        }
    }

    [HttpGet("{provider}/callback")]
    public async Task<IActionResult> WebCallback(string provider, [FromQuery] string? code, [FromQuery] string? state)
    {
        if (string.IsNullOrEmpty(code))
        {
            return BadRequest("Authorization code is missing");
        }

        if (!Enum.TryParse<OAuthProvider>(provider, true, out var oauthProvider))
        {
            return BadRequest($"Unsupported provider: {provider}");
        }

        // Validate state parameter to prevent CSRF attacks
        if (!_oauthStateService.ValidateAndConsumeState(state, provider))
        {
            _logger.LogWarning("Invalid or missing OAuth state parameter for provider: {Provider}", provider);
            return Redirect($"/login?error={HttpUtility.UrlEncode("Invalid authentication state. Please try again.")}");
        }

        try
        {
            var redirectUri = GetWebRedirectUri(provider);
            var organizer = await _authService.ProcessOAuthCallbackAsync(oauthProvider, code, redirectUri);
            var token = await _authService.GenerateTokenAsync(organizer);
            Response.Cookies.Append(AuthConstants.AuthCookieName, token, CreateAuthCookieOptions());
            return Redirect("/cabinet");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing OAuth callback for provider: {Provider}", provider);
            return Redirect($"/login?error={HttpUtility.UrlEncode("Authentication failed")}");
        }
    }

    [HttpPost("exchange")]
    public async Task<ActionResult<AuthExchangeResponse>> ExchangeCode([FromBody] AuthExchangeRequest request)
    {
        if (request == null || string.IsNullOrEmpty(request.Code) || string.IsNullOrEmpty(request.Provider))
        {
            return BadRequest("Code and provider are required");
        }

        if (!Enum.TryParse<OAuthProvider>(request.Provider, true, out var oauthProvider))
        {
            return BadRequest($"Unsupported provider: {request.Provider}");
        }

        // Validate state parameter to prevent CSRF attacks
        if (!string.IsNullOrEmpty(request.State) && !_oauthStateService.ValidateAndConsumeState(request.State, request.Provider))
        {
            _logger.LogWarning("Invalid OAuth state parameter for provider: {Provider}", request.Provider);
            return Unauthorized("Invalid authentication state");
        }

        try
        {
            var redirectUri = "cherryplaylist://auth";
            var organizer = await _authService.ProcessOAuthCallbackAsync(oauthProvider, request.Code, redirectUri, request.DeviceId);
            var token = await _authService.GenerateTokenAsync(organizer);

            return Ok(new AuthExchangeResponse(token));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exchanging code for provider: {Provider}", request.Provider);
            return Unauthorized("Failed to exchange authorization code");
        }
    }

    [HttpPost("vkid/exchange")]
    public async Task<ActionResult<AuthExchangeResponse>> ExchangeVkIdCode([FromBody] AuthExchangeRequest request)
    {
        if (request == null || string.IsNullOrEmpty(request.Code))
        {
            return BadRequest("Code is required");
        }

        try
        {
            var baseUrl = _configuration["OAUTH_REDIRECT_BASE_URL"] ??
                         $"{Request.Scheme}://{Request.Host}";
            var redirectUri = baseUrl;

            var organizer = await _authService.ProcessOAuthCallbackAsync(OAuthProvider.Vk, request.Code, redirectUri, request.DeviceId);
            var token = await _authService.GenerateTokenAsync(organizer);
            Response.Cookies.Append(AuthConstants.AuthCookieName, token, CreateAuthCookieOptions());
            return Ok(new AuthExchangeResponse(token));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error exchanging VK ID code");
            return Unauthorized("Failed to exchange VK ID authorization code");
        }
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthExchangeResponse>> Register([FromBody] RegisterRequest request)
    {
        if (request == null)
        {
            return BadRequest("Request is required");
        }

        var result = await _authService.RegisterAsync(request.Email, request.Password, request.Name);

        if (!result.Success)
        {
            if (result.ErrorMessage?.Contains("already registered") == true)
            {
                return Conflict(result.ErrorMessage);
            }
            return BadRequest(result.ErrorMessage);
        }

        Response.Cookies.Append(AuthConstants.AuthCookieName, result.Token!, CreateAuthCookieOptions());
        return Ok(new AuthExchangeResponse(result.Token!));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthExchangeResponse>> Login([FromBody] LoginRequest request)
    {
        if (request == null)
        {
            return BadRequest("Request is required");
        }

        var result = await _authService.LoginAsync(request.Email, request.Password);

        if (!result.Success)
        {
            return Unauthorized(result.ErrorMessage ?? AuthConstants.InvalidCredentialsMessage);
        }

        Response.Cookies.Append(AuthConstants.AuthCookieName, result.Token!, CreateAuthCookieOptions());
        return Ok(new AuthExchangeResponse(result.Token!));
    }

    [HttpPost("logout")]
    [AuthorizeOrganizer]
    public async Task<IActionResult> Logout()
    {
        var sessionId = HttpContext.GetSessionId();
        if (sessionId.HasValue)
        {
            await _sessionRepository.RemoveAsync(sessionId.Value);
        }

        Response.Cookies.Delete(AuthConstants.AuthCookieName);
        return NoContent();
    }

    private string GetWebRedirectUri(string provider)
    {
        var baseUrl = _configuration["OAUTH_REDIRECT_BASE_URL"] ??
                     $"{Request.Scheme}://{Request.Host}";
        return $"{baseUrl}/auth/{provider}/callback";
    }

    private static bool IsAllowedRedirectUri(string redirectUri, bool forDesktop)
    {
        if (string.IsNullOrWhiteSpace(redirectUri)) return false;
        if (redirectUri.StartsWith("cherryplaylist://auth", StringComparison.OrdinalIgnoreCase))
            return true;
        if (!Uri.TryCreate(redirectUri, UriKind.Absolute, out var uri) || !uri.IsAbsoluteUri)
            return false;
        if (forDesktop)
        {
            // Only allow http://127.0.0.1 with specific ports for security
            if (uri.Scheme.Equals("http", StringComparison.OrdinalIgnoreCase) &&
                uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase))
            {
                // Allow common ports: 8080, 3000, 5173, 5174 (common dev ports)
                // Or no port specified (defaults to 80)
                var port = uri.Port == -1 ? 80 : uri.Port;
                var allowedPorts = new[] { 80, 8080, 3000, 5173, 5174 };
                return allowedPorts.Contains(port);
            }
        }
        return false;
    }

    private CookieOptions CreateAuthCookieOptions()
    {
        // В production всегда используем Secure и SameSite=None для cross-origin запросов
        // В development используем Lax для локальной разработки
        var isProduction = !Request.HttpContext.RequestServices
            .GetRequiredService<IWebHostEnvironment>().IsDevelopment();

        return new CookieOptions
        {
            HttpOnly = true,
            Secure = isProduction || Request.IsHttps,
            SameSite = (isProduction && Request.IsHttps) ? SameSiteMode.None : SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(AuthConstants.TokenLifetimeDays)
        };
    }
}
