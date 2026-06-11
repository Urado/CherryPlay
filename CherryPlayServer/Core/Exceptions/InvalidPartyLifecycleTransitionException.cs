using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Exceptions;

public class InvalidPartyLifecycleTransitionException : Exception
{
    public Guid PartyId { get; }
    public PartyLifecycleState CurrentState { get; }
    public PartyLifecycleState RequestedState { get; }

    public InvalidPartyLifecycleTransitionException(
        Guid partyId,
        PartyLifecycleState currentState,
        PartyLifecycleState requestedState)
        : base(
            $"Cannot transition party {partyId} from {currentState} to {requestedState}")
    {
        PartyId = partyId;
        CurrentState = currentState;
        RequestedState = requestedState;
    }
}
