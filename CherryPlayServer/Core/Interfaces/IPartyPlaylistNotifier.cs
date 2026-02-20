namespace CherryPlayServer.Core.Interfaces;

public interface IPartyPlaylistNotifier
{
    Task NotifyPlaylistChangedAsync(Guid partyId);
}
