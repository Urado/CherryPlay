using CherryPlayServer.Core;

namespace CherryPlayServer.Core.Exceptions;

public class PartyLimitReachedException : Exception
{
    public const string ErrorCode = "future_party_limit_reached";

    public int Limit { get; } = AuthConstants.MaxFuturePartiesPerOrganizer;

    public PartyLimitReachedException(string message)
        : base(message)
    {
    }
}
