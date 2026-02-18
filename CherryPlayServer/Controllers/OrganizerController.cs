using Microsoft.AspNetCore.Mvc;
using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Extensions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Mappings;
using CherryPlayServer.Models;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/organizer")]
public class OrganizerController : ControllerBase
{
    private readonly IOrganizerRepository _organizerRepository;
    private readonly ILogger<OrganizerController> _logger;

    public OrganizerController(
        IOrganizerRepository organizerRepository,
        ILogger<OrganizerController> logger)
    {
        _organizerRepository = organizerRepository ?? throw new ArgumentNullException(nameof(organizerRepository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Получить профиль текущего организатора
    /// </summary>
    [HttpGet("me")]
    [AuthorizeOrganizer]
    public async Task<ActionResult<OrganizerDto>> GetMe()
    {
        var organizerId = HttpContext.GetOrganizerId();
        if (!organizerId.HasValue)
        {
            return Unauthorized("Authentication required");
        }

        try
        {
            var organizer = await _organizerRepository.GetByIdAsync(organizerId.Value);
            if (organizer == null)
            {
                return NotFound("Organizer not found");
            }

            var dto = OrganizerMapper.ToDto(organizer);
            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting organizer profile: {OrganizerId}", organizerId);
            return StatusCode(500, "An error occurred while retrieving organizer profile");
        }
    }

    /// <summary>
    /// Обновить профиль организатора
    /// </summary>
    [HttpPatch("profile")]
    [AuthorizeOrganizer]
    public async Task<ActionResult<OrganizerDto>> UpdateProfile([FromBody] UpdateOrganizerDto dto)
    {
        var organizerId = HttpContext.GetOrganizerId();
        if (!organizerId.HasValue)
        {
            return Unauthorized("Authentication required");
        }

        if (dto == null)
        {
            return BadRequest("Request body cannot be null");
        }

        try
        {
            var organizer = await _organizerRepository.GetByIdAsync(organizerId.Value);
            if (organizer == null)
            {
                return NotFound("Organizer not found");
            }

            // Обновляем поля
            if (!string.IsNullOrEmpty(dto.Name))
            {
                organizer.Name = dto.Name;
            }

            if (dto.LogoUrl != null)
            {
                organizer.LogoUrl = dto.LogoUrl;
            }

            if (dto.Links != null)
            {
                organizer.Links = dto.Links;
            }

            organizer.UpdatedAt = DateTime.UtcNow;

            await _organizerRepository.UpdateAsync(organizer);

            var updatedDto = OrganizerMapper.ToDto(organizer);
            return Ok(updatedDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating organizer profile: {OrganizerId}", organizerId);
            return StatusCode(500, "An error occurred while updating organizer profile");
        }
    }
}
