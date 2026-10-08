using Microsoft.AspNetCore.Mvc;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    [HttpGet("live")]
    public IActionResult GetLiveness()
    {
        return Ok(new { status = "Healthy", timestamp = DateTime.UtcNow });
    }

    [HttpGet]
    public IActionResult Get()
    {
        return GetLiveness();
    }
}
