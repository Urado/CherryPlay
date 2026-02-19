using CherryPlayServer.Core.Entities;
using CherryPlayServer.Models;

namespace CherryPlayServer.Core.Mappings;

public static class OrganizerMapper
{
    public static OrganizerDto ToDto(Organizer organizer)
    {
        return new OrganizerDto(
            Id: organizer.Id.ToString(),
            Name: organizer.Name,
            LogoUrl: organizer.LogoUrl,
            Links: organizer.Links,
            DefaultThemeId: organizer.DefaultThemeId,
            DefaultCustomizationSettings: organizer.DefaultCustomizationSettings,
            TimeZone: organizer.TimeZone,
            CreatedAt: organizer.CreatedAt.ToString("O"),
            UpdatedAt: organizer.UpdatedAt?.ToString("O")
        );
    }
}
