using System.Text.Json.Serialization;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using Microsoft.AspNetCore.Mvc;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/config")]
public class ConfigController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IDesktopCompatibilityWarningService _compatibilityWarningService;
    private readonly IDesktopUpdateVersionService _desktopUpdateVersionService;

    public ConfigController(
        IConfiguration configuration,
        IDesktopCompatibilityWarningService compatibilityWarningService,
        IDesktopUpdateVersionService desktopUpdateVersionService)
    {
        _configuration = configuration;
        _compatibilityWarningService = compatibilityWarningService;
        _desktopUpdateVersionService = desktopUpdateVersionService;
    }

    [HttpGet]
    public async Task<ActionResult<AppConfigResponse>> Get(CancellationToken cancellationToken)
    {
        var oauthEnabled = _configuration.GetValue("Auth:OAuthEnabled", false);
        var partyInfoPageEnabled = _configuration.GetValue("Features:PartyInfoPageEnabled", false);
        var adminContactUrl = Environment.GetEnvironmentVariable("ADMIN_CONTACT_URL")
            ?? _configuration["Admin:ContactUrl"]
            ?? "https://vk.com/<owner>";
        return Ok(new AppConfigResponse(
            oauthEnabled,
            partyInfoPageEnabled,
            adminContactUrl,
            _compatibilityWarningService.GetWarning(),
            await _desktopUpdateVersionService.GetLatestVersionAsync(cancellationToken)));
    }
}

public record AppConfigResponse(
    [property: JsonPropertyName("oauthEnabled")] bool OAuthEnabled,
    [property: JsonPropertyName("partyInfoPageEnabled")] bool PartyInfoPageEnabled,
    [property: JsonPropertyName("adminContactUrl")] string AdminContactUrl,
    [property: JsonPropertyName("desktopCompatibilityWarning")] DesktopCompatibilityWarning? DesktopCompatibilityWarning = null,
    [property: JsonPropertyName("desktopUpdateVersion")] string? DesktopUpdateVersion = null);
