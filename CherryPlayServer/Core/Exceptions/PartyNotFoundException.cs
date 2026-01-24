namespace CherryPlayServer.Core.Exceptions;

public class PartyNotFoundException : Exception
{
    public Guid PartyId { get; }

    public PartyNotFoundException(Guid partyId)
        : base($"Party with ID {partyId} not found")
    {
        PartyId = partyId;
    }

    public PartyNotFoundException(Guid partyId, Exception innerException)
        : base($"Party with ID {partyId} not found", innerException)
    {
        PartyId = partyId;
    }
}
