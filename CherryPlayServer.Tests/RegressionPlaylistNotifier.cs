using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Tests;

internal sealed class RegressionPlaylistNotifier : IPartyPlaylistNotifier
{
    public Task NotifyPlaylistChangedAsync(Guid partyId) => Task.CompletedTask;
}
