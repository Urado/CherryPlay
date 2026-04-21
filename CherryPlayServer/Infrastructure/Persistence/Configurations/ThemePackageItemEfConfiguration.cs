using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class ThemePackageItemEfConfiguration : IEntityTypeConfiguration<ThemePackageItemEf>
{
    public void Configure(EntityTypeBuilder<ThemePackageItemEf> builder)
    {
        builder.ToTable("theme_package_items");
        builder.HasKey(x => new { x.PackageId, x.ThemeId });
        builder.Property(x => x.ThemeId).HasMaxLength(100);
        builder.HasIndex(x => x.ThemeId);
        builder.HasOne(x => x.Package).WithMany(x => x.Items).HasForeignKey(x => x.PackageId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.Theme).WithMany(x => x.PackageItems).HasForeignKey(x => x.ThemeId).OnDelete(DeleteBehavior.Restrict);
    }
}
