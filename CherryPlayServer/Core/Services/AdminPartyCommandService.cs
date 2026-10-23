using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Core.Services;

public sealed class AdminPartyCommandService(
    IAdminPartyRepository repository,
    IStreamingRepository streamingRepository,
    IOrganizerConnectionTracker connectionTracker,
    IPartyActivityCoordinator activityCoordinator,
    IPartyStateNotifier stateNotifier,
    IPartySessionResetNotifier sessionResetNotifier) : IAdminPartyCommandService
{
    public Task<AdminPartyCommandResult> SetLifecycleStateAsync(
        Guid partyId,
        PartyLifecycleState state,
        CancellationToken cancellationToken = default)
    {
        if (!Enum.IsDefined(state))
        {
            throw new ArgumentOutOfRangeException(nameof(state));
        }

        return activityCoordinator.ExecuteAsync(partyId, async () =>
        {
            var party = await repository.GetMutablePartyAsync(partyId, cancellationToken);
            if (party is null)
            {
                return new AdminPartyCommandResult(AdminPartyCommandResultKind.NotFound, null);
            }

            if (party.PartyLifecycleState == state)
            {
                return new AdminPartyCommandResult(AdminPartyCommandResultKind.Unchanged, party);
            }

            var session = await streamingRepository.GetSessionStateAsync(partyId);
            if (session?.IsActive == true && connectionTracker.IsOrganizerConnected(partyId))
            {
                return new AdminPartyCommandResult(AdminPartyCommandResultKind.ActiveConnectedSession, party);
            }

            party.SetLifecycleForAdministrator(state);
            if (!await repository.SetLifecycleStateAsync(partyId, state, cancellationToken))
            {
                return new AdminPartyCommandResult(AdminPartyCommandResultKind.NotFound, null);
            }

            await stateNotifier.NotifyStateChangedAsync(partyId);
            return new AdminPartyCommandResult(AdminPartyCommandResultKind.Updated, party);
        }, cancellationToken);
    }

    public Task<AdminPartyCommandResult> SetCatalogVisibilityAsync(
        Guid partyId,
        bool isListedInCatalog,
        CancellationToken cancellationToken = default) =>
        activityCoordinator.ExecuteAsync(partyId, async () =>
        {
            var party = await repository.GetMutablePartyAsync(partyId, cancellationToken);
            if (party is null)
            {
                return new AdminPartyCommandResult(AdminPartyCommandResultKind.NotFound, null);
            }

            if (party.IsListedInCatalog == isListedInCatalog)
            {
                return new AdminPartyCommandResult(AdminPartyCommandResultKind.Unchanged, party);
            }

            party.SetCatalogVisibility(isListedInCatalog);
            if (!await repository.SetCatalogVisibilityAsync(partyId, isListedInCatalog, cancellationToken))
            {
                return new AdminPartyCommandResult(AdminPartyCommandResultKind.NotFound, null);
            }

            return new AdminPartyCommandResult(AdminPartyCommandResultKind.Updated, party);
        }, cancellationToken);

    public Task<AdminPartyCommandResult> ResetSessionAsync(Guid partyId, CancellationToken cancellationToken = default) =>
        activityCoordinator.ExecuteAsync(partyId, async () =>
        {
            var party = await repository.GetMutablePartyAsync(partyId, cancellationToken);
            if (party is null)
            {
                return new AdminPartyCommandResult(AdminPartyCommandResultKind.NotFound, null);
            }

            var connected = connectionTracker.IsOrganizerConnected(partyId);
            var session = await streamingRepository.GetSessionStateAsync(partyId);
            if (session is { IsActive: true } && connected)
            {
                return new AdminPartyCommandResult(
                    AdminPartyCommandResultKind.ActiveConnectedSession,
                    party,
                    session,
                    false,
                    connected);
            }

            if (session is null)
            {
                return new AdminPartyCommandResult(
                    AdminPartyCommandResultKind.Unchanged,
                    party,
                    null,
                    false,
                    connected);
            }

            var changed = session.ResetForAdministration(DateTime.UtcNow);
            if (!changed)
            {
                return new AdminPartyCommandResult(
                    AdminPartyCommandResultKind.Unchanged,
                    party,
                    session,
                    false,
                    connected);
            }

            await streamingRepository.SetSessionStateAsync(partyId, session);
            await sessionResetNotifier.NotifySessionResetAsync(partyId, party.PartyLifecycleState, session);
            return new AdminPartyCommandResult(
                AdminPartyCommandResultKind.Updated,
                party,
                session,
                true,
                connected);
        }, cancellationToken);
}
