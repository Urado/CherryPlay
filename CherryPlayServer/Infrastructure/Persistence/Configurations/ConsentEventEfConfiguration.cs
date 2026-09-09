using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class ConsentEventEfConfiguration : IEntityTypeConfiguration<ConsentEventEf>
{
    public void Configure(EntityTypeBuilder<ConsentEventEf> builder)
    {
        builder.ToTable("consent_events");
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_consent_events_decision",
            "decision IN ('grant','withdraw','deny')"));

        builder.HasKey(e => e.Id);
        builder.Property(e => e.DocumentHash).IsRequired().HasMaxLength(256);
        builder.Property(e => e.Decision).IsRequired().HasMaxLength(32);
        builder.Property(e => e.EventAt).IsRequired();

        builder.HasOne<OrganizerEf>()
            .WithMany()
            .HasForeignKey(e => e.SubjectId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.LegalDocumentVersion)
            .WithMany()
            .HasForeignKey(e => e.LegalDocumentVersionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(e => new { e.SubjectId, e.EventAt });
        builder.HasIndex(e => new { e.SubjectId, e.LegalDocumentVersionId });
    }
}
