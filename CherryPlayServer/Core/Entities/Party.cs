using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;

namespace CherryPlayServer.Core.Entities;

public class Party
{
    private PartyLifecycleState _partyLifecycleState = PartyLifecycleState.Draft;
    private bool _isListedInCatalog;
    private bool _isDeleted;

    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? Subtitle { get; set; }
    public string ShortCode { get; set; } = string.Empty;
    public PartyThemeId PartyThemeId { get; set; } = PartyThemeDefaults.Id;
    public Dictionary<string, object>? CustomizationSettings { get; set; }
    public PartyPlaylist Playlist { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EventDateTime { get; set; }
    public DateTime? EventEndDateTime { get; set; }
    public bool IsListedInCatalog
    {
        get => _isListedInCatalog;
        init => _isListedInCatalog = value;
    }
    public bool IsDeleted
    {
        get => _isDeleted;
        init => _isDeleted = value;
    }
    public string? Description { get; set; }
    public string? Place { get; set; }
    public string? City { get; set; }
    public string? Schedule { get; set; }
    public string? TimeZone { get; set; }
    public string? ShortDescription { get; set; }
    public string? ExternalLinkUrl { get; set; }
    public string? ExternalLinkText { get; set; }
    public List<string> DanceTags { get; set; } = [];
    public PartyLifecycleState PartyLifecycleState
    {
        get => _partyLifecycleState;
        init => _partyLifecycleState = value;
    }

    public void TransitionLifecycleForOrganizer(PartyLifecycleState targetState)
    {
        EnsureNotDeleted();
        if (!Enum.IsDefined(targetState))
        {
            throw new ArgumentOutOfRangeException(nameof(targetState));
        }

        if (PartyLifecycleState == targetState)
        {
            return;
        }

        if (!IsOrganizerTransitionAllowed(PartyLifecycleState, targetState))
        {
            throw new InvalidPartyLifecycleTransitionException(Id, PartyLifecycleState, targetState);
        }

        _partyLifecycleState = targetState;
    }

    public void SetLifecycleForAdministrator(PartyLifecycleState targetState)
    {
        EnsureNotDeleted();
        if (!Enum.IsDefined(targetState))
        {
            throw new ArgumentOutOfRangeException(nameof(targetState));
        }

        _partyLifecycleState = targetState;
    }

    public void SetCatalogVisibility(bool isListedInCatalog)
    {
        EnsureNotDeleted();
        _isListedInCatalog = isListedInCatalog;
    }

    public void MarkAsDeleted()
    {
        _isDeleted = true;
    }

    private void EnsureNotDeleted()
    {
        if (IsDeleted)
        {
            throw new InvalidOperationException("A deleted party is read-only.");
        }
    }

    private static bool IsOrganizerTransitionAllowed(
        PartyLifecycleState currentState,
        PartyLifecycleState targetState) =>
        (currentState, targetState) switch
        {
            (PartyLifecycleState.Draft, PartyLifecycleState.Ready) => true,
            (PartyLifecycleState.Ready, PartyLifecycleState.Completed) => true,
            (PartyLifecycleState.Completed, PartyLifecycleState.Ready) => true,
            _ => false,
        };
}
