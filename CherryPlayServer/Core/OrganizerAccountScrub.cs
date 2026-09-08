using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core;

/// <summary>
/// PII / privilege scrub applied before soft-delete on account deletion.
/// </summary>
public static class OrganizerAccountScrub
{
    public static void Apply(Organizer organizer)
    {
        ArgumentNullException.ThrowIfNull(organizer);

        organizer.Name = OrganizerDisplayNames.Deleted;
        organizer.LogoUrl = null;
        organizer.Links = null;
        organizer.TimeZone = null;
        organizer.DefaultCustomizationSettings = null;
        organizer.DefaultPartyThemeId = null;
        organizer.Role = OrganizerRole.Organizer;
        organizer.UpdatedAt = DateTime.UtcNow;
    }
}
