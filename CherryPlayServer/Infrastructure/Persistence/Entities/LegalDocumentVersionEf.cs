namespace CherryPlayServer.Infrastructure.Persistence.Entities;

public class LegalDocumentVersionEf
{
    public Guid Id { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string DocumentVersion { get; set; } = string.Empty;
    public string ContentHash { get; set; } = string.Empty;
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public string Status { get; set; } = string.Empty;
}
