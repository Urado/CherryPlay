using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Models;

public record LegalDocumentVersionInfo(
    Guid Id,
    LegalDocumentType DocumentType,
    string DocumentVersion,
    string ContentHash,
    LegalDocumentVersionStatus Status
);
