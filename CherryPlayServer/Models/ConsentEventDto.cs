using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record ConsentEventDto(
    Guid Id,
    Guid LegalDocumentVersionId,
    string DocumentHash,
    ConsentDecision Decision,
    DateTimeOffset EventAt
);
