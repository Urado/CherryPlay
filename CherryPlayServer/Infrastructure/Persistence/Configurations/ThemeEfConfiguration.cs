using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class ThemeEfConfiguration : IEntityTypeConfiguration<ThemeEf>
{
    public void Configure(EntityTypeBuilder<ThemeEf> builder)
    {
        builder.ToTable("themes");
        builder.ToTable(t => t.HasCheckConstraint("ck_themes_visibility", "visibility IN ('public','private')"));
        builder.HasKey(x => x.ThemeId);
        builder.Property(x => x.ThemeId).HasMaxLength(100);
        builder.Property(x => x.DisplayName).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Visibility).IsRequired().HasMaxLength(16).HasDefaultValue("public");
    }
}
