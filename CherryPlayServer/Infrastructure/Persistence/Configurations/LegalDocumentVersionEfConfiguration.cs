using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class LegalDocumentVersionEfConfiguration : IEntityTypeConfiguration<LegalDocumentVersionEf>
{
    private static readonly DateTime SeedRetiredEffectiveFrom = DateTime.SpecifyKind(
        DateTime.UnixEpoch,
        DateTimeKind.Utc);

    private static readonly DateTime SeedRetiredEffectiveTo = DateTime.SpecifyKind(
        new DateTime(2024, 1, 1, 0, 0, 0),
        DateTimeKind.Utc);

    private const string PdConsentHashV1 =
        "4fb5ee6b4636828a5f72c3b1091721e02c53c93160db5449e80348f24e0f84bc";
    private const string TermsHashV1 =
        "63446e6df641cb350ba24e197390c03f76ded704bfe12e692eeeb62c84e14b44";
    private const string PdConsentDocumentVersionV1 = "1.0";
    private const string TermsDocumentVersionV1 = "1.0";
    private static readonly DateTime PdConsentEffectiveFromV1 = DateTime.SpecifyKind(
        new DateTime(2026, 9, 1, 0, 0, 0),
        DateTimeKind.Utc);
    private static readonly DateTime TermsEffectiveFromV1 = DateTime.SpecifyKind(
        new DateTime(2026, 9, 1, 0, 0, 0),
        DateTimeKind.Utc);

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
                DocumentVersion = PdConsentDocumentVersionV1,
                ContentHash = PdConsentHashV1,
                EffectiveFrom = PdConsentEffectiveFromV1,
                EffectiveTo = null,
                Status = "active",
            },
            new LegalDocumentVersionEf
            {
                Id = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                DocumentType = "terms",
                DocumentVersion = TermsDocumentVersionV1,
                ContentHash = TermsHashV1,
                EffectiveFrom = TermsEffectiveFromV1,
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
