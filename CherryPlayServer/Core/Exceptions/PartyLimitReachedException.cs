namespace CherryPlayServer.Core.Exceptions;

public class PartyLimitReachedException : Exception
{
    public PartyLimitReachedException(string message)
        : base(message)
    {
    }
}
