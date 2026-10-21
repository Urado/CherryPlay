using CherryPlayServer.Core.Entities;

namespace CherryPlayServer.Core.Interfaces;

public interface IPartyMetadataRepository
{
    Task UpdateMetadataAsync(Party party, bool? isListedInCatalog, CancellationToken cancellationToken = default);
}
