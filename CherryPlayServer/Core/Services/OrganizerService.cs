using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Mappings;
using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Services;

public class OrganizerService : IOrganizerService
{
    private readonly IOrganizerRepository _organizerRepository;

    public OrganizerService(IOrganizerRepository organizerRepository)
    {
        _organizerRepository = organizerRepository ?? throw new ArgumentNullException(nameof(organizerRepository));
    }

    public async Task<OrganizerDto?> GetByIdAsync(Guid organizerId)
    {
        var organizer = await _organizerRepository.GetByIdAsync(organizerId);
        return organizer == null ? null : OrganizerMapper.ToDto(organizer);
    }

    public async Task<OrganizerDto?> UpdateProfileAsync(Guid organizerId, UpdateOrganizerDto dto)
    {
        if (dto == null)
        {
            throw new ArgumentNullException(nameof(dto));
        }

        var organizer = await _organizerRepository.GetByIdAsync(organizerId);
        if (organizer == null)
        {
            return null;
        }

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

        if (dto.TimeZone != null)
        {
            organizer.TimeZone = dto.TimeZone;
        }

        organizer.UpdatedAt = DateTime.UtcNow;
        await _organizerRepository.UpdateAsync(organizer);

        return OrganizerMapper.ToDto(organizer);
    }
}
