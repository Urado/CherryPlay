using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class LegalDocumentVersionEfConfiguration : IEntityTypeConfiguration<LegalDocumentVersionEf>
{
    /// <summary>Matches ACTIVE v1.0 frontmatter / legal-registry.generated.json.</summary>
    private static readonly DateTime SeedActiveEffectiveFrom = DateTime.SpecifyKind(
        new DateTime(2026, 9, 1, 0, 0, 0),
        DateTimeKind.Utc);

    private static readonly DateTime SeedRetiredEffectiveFrom = DateTime.SpecifyKind(
        DateTime.UnixEpoch,
        DateTimeKind.Utc);

    private static readonly DateTime SeedRetiredEffectiveTo = DateTime.SpecifyKind(
        new DateTime(2024, 1, 1, 0, 0, 0),
        DateTimeKind.Utc);

    // Keep in sync with scripts/publish-legal.mjs output for ACTIVE v1.0 (LF-normalized SHA-256).
    private const string PdConsentHashV1 =
        "f4c9dcba9ed36f7cfe1087c1e2dc7535008df71cd3ad95bced47f6278092de46";
    private const string TermsHashV1 =
        "889f4423294937c7b0a40fbdb2c6d10dc69d3e44c0ed19338b6a22bacb6ab018";

    public void Configure(EntityTypeBuilder<LegalDocumentVersionEf> builder)
    {
        builder.ToTable("legal_document_versions");
        builder.ToTable(t =>
        {
            t.HasCheckConstraint(
                "ck_legal_document_versions_document_type",
                "document_type IN ('pd_consent_text','terms','privacy_policy','cookie_policy')");
            t.HasCheckConstraint(
                "ck_legal_document_versions_status",
                "status IN ('draft','active','retired')");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.DocumentType).IsRequired().HasMaxLength(64);
        builder.Property(e => e.DocumentVersion).IsRequired().HasMaxLength(64);
        builder.Property(e => e.ContentHash).IsRequired().HasMaxLength(256);
        builder.Property(e => e.EffectiveFrom).IsRequired();
        builder.Property(e => e.Status).IsRequired().HasMaxLength(32);

        builder.HasIndex(e => new { e.DocumentType, e.DocumentVersion }).IsUnique();
        builder.HasIndex(e => e.DocumentType)
            .IsUnique()
            .HasFilter("status = 'active'")
            .HasDatabaseName("ix_legal_document_versions_one_active_per_type");

        builder.HasData(
            new LegalDocumentVersionEf
            {
                Id = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                DocumentType = "pd_consent_text",
                DocumentVersion = "1.0",
                ContentHash = PdConsentHashV1,
                EffectiveFrom = SeedActiveEffectiveFrom,
                EffectiveTo = null,
                Status = "active",
            },
            new LegalDocumentVersionEf
            {
                Id = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                DocumentType = "terms",
                DocumentVersion = "1.0",
                ContentHash = TermsHashV1,
                EffectiveFrom = SeedActiveEffectiveFrom,
                EffectiveTo = null,
                Status = "active",
            },
            new LegalDocumentVersionEf
            {
                Id = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                DocumentType = "pd_consent_text",
                DocumentVersion = "v0",
                ContentHash = "pd-consent-hash-v1",
                EffectiveFrom = SeedRetiredEffectiveFrom,
                EffectiveTo = SeedRetiredEffectiveTo,
                Status = "retired",
            });
    }
}
