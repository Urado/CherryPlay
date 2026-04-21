using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using CherryPlayServer.Infrastructure.Persistence.Entities;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class OrganizerEfConfiguration : IEntityTypeConfiguration<OrganizerEf>
{
    public void Configure(EntityTypeBuilder<OrganizerEf> builder)
    {
        builder.ToTable("organizers");
        builder.ToTable(t => t.HasCheckConstraint("ck_organizers_role", "role IN ('organizer','admin')"));
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Name).IsRequired().HasMaxLength(500);
        builder.Property(e => e.Role).IsRequired().HasMaxLength(32).HasDefaultValue("organizer");
        builder.Property(e => e.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(e => e.IsDeleted);
    }
}
