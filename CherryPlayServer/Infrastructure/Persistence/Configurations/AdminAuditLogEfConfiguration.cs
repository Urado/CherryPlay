using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class AdminAuditLogEfConfiguration : IEntityTypeConfiguration<AdminAuditLogEf>
{
    public void Configure(EntityTypeBuilder<AdminAuditLogEf> builder)
    {
        builder.ToTable("admin_audit_log");
        builder.ToTable(t => t.HasCheckConstraint("ck_admin_audit_log_action", "action IN ('grant_package','revoke_package')"));
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Action).IsRequired().HasMaxLength(64);
        builder.HasIndex(x => x.AdminId);
        builder.HasIndex(x => x.TargetOrganizerId);
        builder.HasIndex(x => x.CreatedAt);
        builder.HasOne<OrganizerEf>().WithMany().HasForeignKey(x => x.AdminId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<OrganizerEf>().WithMany().HasForeignKey(x => x.TargetOrganizerId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<ThemePackageEf>().WithMany().HasForeignKey(x => x.PackageId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<OrganizerEntitlementEf>().WithMany().HasForeignKey(x => x.EntitlementId).OnDelete(DeleteBehavior.SetNull);
    }
}
