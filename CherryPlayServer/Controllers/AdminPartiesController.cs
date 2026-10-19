using CherryPlayServer.Core.Attributes;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Mappings;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CherryPlayServer.Controllers;

[ApiController]
[Route("api/admin/parties")]
[AuthorizeAdmin]
[EnableRateLimiting("admin-strict")]
public sealed class AdminPartiesController(
    IAdminPartyQueryService queryService,
    IAdminPartyCommandService commandService) : ControllerBase
{
    [HttpGet]
    [EndpointName("AdminParties_GetPage")]
    [EndpointSummary("List all parties for administration")]
    [EndpointDescription("Returns filtered, paginated party records including hidden and deleted parties.")]
    [ProducesResponseType<AdminPartyListDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<AdminPartyListDto>> GetPage(
        [FromQuery] Guid? organizerId,
        [FromQuery] string? query,
        [FromQuery] string? city,
        [FromQuery] PartyLifecycleState? partyLifecycleState,
        [FromQuery] bool? isListedInCatalog,
        [FromQuery] bool? isDeleted,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        if (page < 1)
        {
            ModelState.AddModelError(nameof(page), "page must be positive.");
        }

        if (pageSize is < 1 or > 100)
        {
            ModelState.AddModelError(nameof(pageSize), "pageSize must be between 1 and 100.");
        }

        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var result = await queryService.GetPageAsync(
            organizerId,
            query,
            city,
            partyLifecycleState,
            isListedInCatalog,
            isDeleted,
            page,
            pageSize,
            cancellationToken);
        return Ok(new AdminPartyListDto(
            Array.AsReadOnly(result.Items.Select(ToDto).ToArray()),
            result.Total,
            result.Page,
            result.PageSize));
    }

    [HttpGet("{id:guid}")]
    [EndpointName("AdminParties_GetById")]
    [EndpointSummary("Get a party administration detail card")]
    [EndpointDescription("Returns party, organizer, playlist, lifecycle, catalog, deletion, and session details, including deleted parties.")]
    [ProducesResponseType<AdminPartyDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminPartyDetailDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var detail = await queryService.GetByIdAsync(id, cancellationToken);
        return detail is null ? NotFound(new { code = "party_not_found" }) : Ok(ToDetailDto(detail));
    }

    [HttpPatch("{id:guid}/lifecycle")]
    [EndpointName("AdminParties_SetLifecycle")]
    [EndpointSummary("Change a party lifecycle state")]
    [EndpointDescription("Allows administrators to set any party lifecycle state unless an active session has a connected organizer desktop.")]
    [ProducesResponseType<AdminPartyMutationDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AdminPartyMutationDto>> SetLifecycleState(
        Guid id,
        [FromBody] AdminPartyLifecycleRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(request.PartyLifecycleState))
        {
            ModelState.AddModelError(nameof(request.PartyLifecycleState), "A supported party lifecycle state is required.");
            return ValidationProblem(ModelState);
        }

        var result = await commandService.SetLifecycleStateAsync(id, request.PartyLifecycleState, cancellationToken);
        if (result.Kind == AdminPartyCommandResultKind.NotFound)
        {
            return NotFound(new { code = "party_not_found" });
        }

        if (result.Kind == AdminPartyCommandResultKind.ActiveConnectedSession)
        {
            var problem = new ProblemDetails
            {
                Type = "https://cherryplay.ru/problems/active-connected-session",
                Title = "Party state cannot be changed during an active session",
                Status = StatusCodes.Status409Conflict,
                Detail = "Disconnect the organizer desktop or end the session before changing the party state."
            };
            problem.Extensions["code"] = "active_connected_session";
            return Conflict(problem);
        }

        return Ok(ToMutationDto(result.Party!));
    }

    [HttpPatch("{id:guid}/catalog-visibility")]
    [EndpointName("AdminParties_SetCatalogVisibility")]
    [EndpointSummary("Change catalog visibility")]
    [EndpointDescription("Sets whether a party appears in the public party catalog.")]
    [ProducesResponseType<AdminPartyMutationDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminPartyMutationDto>> SetCatalogVisibility(
        Guid id,
        [FromBody] AdminPartyCatalogVisibilityRequest request,
        CancellationToken cancellationToken)
    {
        var result = await commandService.SetCatalogVisibilityAsync(id, request.IsListedInCatalog, cancellationToken);
        return result.Kind == AdminPartyCommandResultKind.NotFound
            ? NotFound(new { code = "party_not_found" })
            : Ok(ToMutationDto(result.Party!));
    }

    [HttpPost("{id:guid}/session-resets")]
    [EndpointName("AdminParties_ResetSession")]
    [EndpointSummary("Reset a party session and playback state")]
    [EndpointDescription("Ends stale sessions and clears playback markers while preserving the party playlist and metadata. An active session with a connected organizer desktop cannot be reset.")]
    [ProducesResponseType<AdminPartySessionResetDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AdminPartySessionResetDto>> ResetSession(Guid id, CancellationToken cancellationToken)
    {
        var result = await commandService.ResetSessionAsync(id, cancellationToken);
        if (result.Kind == AdminPartyCommandResultKind.NotFound)
        {
            return NotFound(new { code = "party_not_found" });
        }

        if (result.Kind == AdminPartyCommandResultKind.ActiveConnectedSession)
        {
            var problem = new ProblemDetails
            {
                Type = "https://cherryplay.ru/problems/active-connected-session",
                Title = "Party session cannot be reset while the organizer desktop is connected",
                Status = StatusCodes.Status409Conflict,
                Detail = "Disconnect the organizer desktop or end the session before resetting playback."
            };
            problem.Extensions["code"] = "active_connected_session";
            return Conflict(problem);
        }

        var state = result.PlaybackState;
        return Ok(new AdminPartySessionResetDto(
            id,
            result.WasReset,
            state?.IsActive ?? false,
            result.IsOrganizerConnected,
            AdminPlaybackStateDto.From(state)));
    }

    private static AdminPartyListItemDto ToDto(AdminPartyListItem item) => new(
        item.Id,
        item.OrganizerId,
        item.OrganizerName,
        item.IsOrganizerDeleted,
        item.Name,
        item.Title,
        item.ShortCode,
        item.City,
        item.EventDateTime,
        item.PartyLifecycleState,
        item.IsListedInCatalog,
        item.IsDeleted,
        item.HasActiveSession,
        item.IsOrganizerConnected);

    private static AdminPartyMutationDto ToMutationDto(Party party) => new(
        party.Id,
        party.PartyLifecycleState,
        party.IsListedInCatalog);

    private static AdminPartyDetailDto ToDetailDto(AdminPartyDetail detail)
    {
        var party = detail.Party;
        return new AdminPartyDetailDto(
            party.Id,
            party.OrganizerId,
            detail.OrganizerName,
            detail.IsOrganizerDeleted,
            party.Name,
            party.Title,
            party.Subtitle,
            party.ShortCode,
            party.City,
            party.CreatedAt,
            party.EventDateTime,
            party.EventEndDateTime,
            party.PartyLifecycleState,
            party.IsListedInCatalog,
            party.IsDeleted,
            detail.PlaybackState?.IsActive == true,
            detail.IsOrganizerConnected,
            party.PartyThemeId,
            party.CustomizationSettings,
            party.Description,
            party.Place,
            party.Schedule,
            party.TimeZone,
            party.ShortDescription,
            party.ExternalLinkUrl,
            party.ExternalLinkText,
            Array.AsReadOnly(party.DanceTags.ToArray()),
            party.Playlist.ToDto(),
            AdminPlaybackStateDto.From(detail.PlaybackState));
    }
}
