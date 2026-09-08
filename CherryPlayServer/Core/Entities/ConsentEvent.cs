using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Core.Entities;

public class ConsentEvent
{
    public Guid Id { get; set; }
    public Guid SubjectId { get; set; }
    public Guid LegalDocumentVersionId { get; set; }
    public string DocumentHash { get; set; } = string.Empty;
    public ConsentDecision Decision { get; set; }
    public DateTimeOffset EventAt { get; set; }
}
