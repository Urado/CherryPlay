using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record ConsentInputDto(
    Guid Id,
    Guid LegalDocumentVersionId,
    string DocumentHash,
    ConsentDecision Decision
);
