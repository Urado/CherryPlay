using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Tests;

public sealed class RecordingPartyStateNotifier : IPartyStateNotifier
{
    public List<Guid> Notifications { get; } = [];

    public Task NotifyStateChangedAsync(Guid partyId)
    {
        Notifications.Add(partyId);
        return Task.CompletedTask;
    }
}
