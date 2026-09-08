using Microsoft.AspNetCore.Mvc;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Models;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/oauth/accounts")]
public class OAuthAccountsController : ControllerBase
{
    private readonly IOAuthAccountsService _oauthAccountsService;

    public OAuthAccountsController(IOAuthAccountsService oauthAccountsService)
    {
        _oauthAccountsService = oauthAccountsService ?? throw new ArgumentNullException(nameof(oauthAccountsService));
    }

    [HttpPost]
    public async Task<ActionResult<CreateOAuthAccountResponse>> Create(
        [FromBody] CreateOAuthAccountRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest("Request body cannot be null");
        }

        var response = await _oauthAccountsService.CreateAsync(request, cancellationToken);
        return Created($"/api/oauth/accounts/{response.Id}", response);
    }
}
