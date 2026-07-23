using Microsoft.AspNetCore.SignalR;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Extensions;

namespace CherryPlayServer.Hubs;

public partial class PartyHub
{
    private async Task SendErrorAsync(string message)
    {
        await Clients.Caller.SendAsync("Error", message);
    }

    private async Task<Guid?> GetOrganizerIdFromContextAsync()
    {
        var httpContext = Context.GetHttpContext();
        if (httpContext == null)
        {
            return null;
        }

        var token = httpContext.Request.Query["access_token"].FirstOrDefault() ??
                   httpContext.ExtractTokenFromRequest();

        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var result = await _jwtService.ValidateTokenAsync(token);
        if (!result.IsValid || !result.OrganizerId.HasValue)
        {
            return null;
        }

        Context.Items["OrganizerId"] = result.OrganizerId.Value;
        Context.Items["OrganizerName"] = result.Name;

        return result.OrganizerId.Value;
    }

    private async Task<Guid?> RequireOrganizerAuthAsync()
    {
        var organizerId = await GetOrganizerIdFromContextAsync();
        if (!organizerId.HasValue)
        {
            await SendErrorAsync("Authentication required");
        }
        return organizerId;
    }

    private async Task<bool> EnsurePartyOwnershipAsync(Guid partyId, Guid organizerId)
    {
        try
        {
            await _partyAccessService.EnsurePartyOwnershipAsync(partyId, organizerId);
            return true;
        }
        catch (PartyNotFoundException)
        {
            await SendErrorAsync("Party not found");
            return false;
        }
        catch (ForbiddenException)
        {
            await SendErrorAsync("You do not have permission to access this party");
            return false;
        }
    }
}
