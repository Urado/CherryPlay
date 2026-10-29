namespace CherryPlayServer.Core.Interfaces;

public interface IPartyStateNotifier
{
    Task NotifyStateChangedAsync(Guid partyId);
}
