using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;

namespace CherryPlayServer.Controllers;

/// <summary>
/// Public app config for clients (e.g. feature flags like OAuth visibility).
/// Does not affect server behavior; used only to hide/show UI.
/// </summary>
[ApiController]
[Route("api/config")]
public class ConfigController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public ConfigController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet]
    public IActionResult Get()
    {
        var oauthEnabled = _configuration.GetValue("Auth:OAuthEnabled", false);
        var partyInfoPageEnabled = _configuration.GetValue("Features:PartyInfoPageEnabled", false);
        var adminContactUrl = Environment.GetEnvironmentVariable("ADMIN_CONTACT_URL")
            ?? _configuration["Admin:ContactUrl"]
            ?? "https://vk.com/<owner>";
        return Ok(new AppConfigResponse(oauthEnabled, partyInfoPageEnabled, adminContactUrl));
    }
}

/// <summary>
/// Response for GET /api/config. Property name is explicitly camelCase for client contract (see CONTRACTS.md §2.2).
/// </summary>
public record AppConfigResponse(
    [property: JsonPropertyName("oauthEnabled")] bool OAuthEnabled,
    [property: JsonPropertyName("partyInfoPageEnabled")] bool PartyInfoPageEnabled,
    [property: JsonPropertyName("adminContactUrl")] string AdminContactUrl);
