using CherryPlayServer.Infrastructure.Persistence.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class DesktopAuthCodeEfConfiguration : IEntityTypeConfiguration<DesktopAuthCodeEf>
{
    public void Configure(EntityTypeBuilder<DesktopAuthCodeEf> builder)
    {
        builder.ToTable("desktop_auth_codes");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.TokenHash).IsRequired().HasMaxLength(64);
        builder.HasIndex(e => e.TokenHash).IsUnique();
        builder.HasIndex(e => e.OrganizerId);
        builder.HasOne(e => e.Organizer)
            .WithMany()
            .HasForeignKey(e => e.OrganizerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
