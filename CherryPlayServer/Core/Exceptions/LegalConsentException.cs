using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Exceptions;

public sealed class LegalConsentException : Exception
{
    public LegalConsentException(
        LegalConsentFailureKind kind,
        string message,
        IReadOnlyList<Guid>? missing = null)
        : base(message)
    {
        Kind = kind;
        Missing = missing;
    }

    public LegalConsentFailureKind Kind { get; }

    public IReadOnlyList<Guid>? Missing { get; }
}
