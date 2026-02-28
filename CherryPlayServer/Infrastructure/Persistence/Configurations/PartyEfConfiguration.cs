using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using CherryPlayServer.Infrastructure.Persistence.Entities;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class PartyEfConfiguration : IEntityTypeConfiguration<PartyEf>
{
    public void Configure(EntityTypeBuilder<PartyEf> builder)
    {
        builder.ToTable("parties");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Name).IsRequired().HasMaxLength(200);
        builder.Property(e => e.Title).HasMaxLength(500);
        builder.Property(e => e.Subtitle).HasMaxLength(500);
        builder.Property(e => e.ShortCode).IsRequired().HasMaxLength(32);
        builder.Property(e => e.PartyThemeId).IsRequired().HasMaxLength(50);
        builder.Property(e => e.IsDeleted).HasDefaultValue(false);
        builder.HasIndex(e => e.ShortCode).IsUnique();
        builder.HasIndex(e => e.OrganizerId);
        builder.HasIndex(e => e.IsListedInCatalog);
        builder.HasOne(e => e.Organizer)
            .WithMany(o => o.Parties)
            .HasForeignKey(e => e.OrganizerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
