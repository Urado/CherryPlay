using Microsoft.AspNetCore.Mvc;
using CherryPlayServer.Models;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/oauth/accounts")]
public class OAuthAccountsController : ControllerBase
{
    [HttpPost]
    public ActionResult<CreateOAuthAccountResponse> Create([FromBody] CreateOAuthAccountRequest request)
    {
        if (request == null)
        {
            return BadRequest("Request body cannot be null");
        }

        var id = Guid.NewGuid();
        var response = new CreateOAuthAccountResponse(
            id,
            string.Empty,
            $"{request.Provider}:stub");

        return Created($"/api/oauth/accounts/{id}", response);
    }
}
