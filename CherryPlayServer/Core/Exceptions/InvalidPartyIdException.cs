namespace CherryPlayServer.Core.Exceptions;

public class InvalidPartyIdException : Exception
{
    public string PartyId { get; }

    public InvalidPartyIdException(string partyId)
        : base($"Invalid party ID format: {partyId}")
    {
        PartyId = partyId;
    }

    public InvalidPartyIdException(string partyId, Exception innerException)
        : base($"Invalid party ID format: {partyId}", innerException)
    {
        PartyId = partyId;
    }
}
