using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Exceptions;

public sealed class LegalConsentException : Exception
{
    public LegalConsentException(LegalConsentFailureKind kind, string message)
        : base(message)
    {
        Kind = kind;
    }

    public LegalConsentFailureKind Kind { get; }
}
