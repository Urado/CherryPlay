namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class ConsentEventEf
{
    public Guid Id { get; set; }
    public Guid SubjectId { get; set; }
    public Guid LegalDocumentVersionId { get; set; }
    public string DocumentHash { get; set; } = string.Empty;
    public string Decision { get; set; } = string.Empty;
    public DateTimeOffset EventAt { get; set; }

    public LegalDocumentVersionEf LegalDocumentVersion { get; set; } = null!;
}
