namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class OrganizerEf
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? LinksJson { get; set; }
    public string? DefaultPartyThemeId { get; set; }
    public string? DefaultCustomizationSettingsJson { get; set; }
    public string? TimeZone { get; set; }
    public string Role { get; set; } = "organizer";
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }

    public ICollection<PartyEf> Parties { get; set; } = [];
    public ICollection<EmailAccountEf> EmailAccounts { get; set; } = [];
    public ICollection<OAuthAccountEf> OAuthAccounts { get; set; } = [];
    public ICollection<OrganizerSessionEf> Sessions { get; set; } = [];
}
