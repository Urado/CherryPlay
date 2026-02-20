namespace CherryPlayServer.Core.Interfaces;

public interface IPartyAccessService
{
    /// <exception cref="CherryPlayServer.Core.Exceptions.PartyNotFoundException">Вечеринка не найдена.</exception>
    /// <exception cref="CherryPlayServer.Core.Exceptions.ForbiddenException">Вечеринка принадлежит другому организатору.</exception>
    Task EnsurePartyOwnershipAsync(Guid partyId, Guid organizerId);
}
