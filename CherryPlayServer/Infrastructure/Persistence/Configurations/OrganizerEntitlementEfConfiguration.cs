using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class OrganizerEntitlementEfConfiguration : IEntityTypeConfiguration<OrganizerEntitlementEf>
{
    public void Configure(EntityTypeBuilder<OrganizerEntitlementEf> builder)
    {
        builder.ToTable("organizer_entitlements");
        builder.ToTable(t =>
        {
            t.HasCheckConstraint("ck_organizer_entitlements_kind", "kind IN ('lifetime','subscription','event_quota')");
            t.HasCheckConstraint("ck_organizer_entitlements_source", "source IN ('admin_grant','purchase','trial')");
        });
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Kind).IsRequired().HasMaxLength(32).HasDefaultValue("lifetime");
        builder.Property(x => x.Source).IsRequired().HasMaxLength(32).HasDefaultValue("admin_grant");
        builder.HasIndex(x => x.OrganizerId);
        builder.HasIndex(x => new { x.OrganizerId, x.PackageId, x.RevokedAt });
        builder.HasIndex(x => x.ExpiresAt);
        builder.HasOne<OrganizerEf>().WithMany().HasForeignKey(x => x.OrganizerId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<ThemePackageEf>().WithMany().HasForeignKey(x => x.PackageId).OnDelete(DeleteBehavior.Restrict);
    }
}
