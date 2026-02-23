using System.ComponentModel.DataAnnotations;
using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record CreatePartyDto
{
    [Required(ErrorMessage = "Party name is required")]
    [StringLength(200, MinimumLength = 1, ErrorMessage = "Party name must be between 1 and 200 characters")]
    public string Name { get; init; } = string.Empty;

    /// <summary>
    /// PartyTheme идентификатор (см. GLOSSARY.md)
    /// </summary>
    public PartyThemeId PartyThemeId { get; init; } = PartyThemeId.Cyberpunk;

    public Dictionary<string, object>? CustomizationSettings { get; init; }

    public PartyPlaylistDto? PlaylistData { get; init; }

    public DateTime? EventDateTime { get; init; }

    public bool IsListedInCatalog { get; init; }

    [StringLength(2000)]
    public string? Description { get; init; }

    [StringLength(200)]
    public string? Place { get; init; }

    [StringLength(100)]
    public string? City { get; init; }

    [StringLength(5000)]
    public string? Schedule { get; init; }

    [StringLength(100)]
    public string? TimeZone { get; init; }
}
