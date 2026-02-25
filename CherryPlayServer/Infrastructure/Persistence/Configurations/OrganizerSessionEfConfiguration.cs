using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using CherryPlayServer.Infrastructure.Persistence.Entities;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class OrganizerSessionEfConfiguration : IEntityTypeConfiguration<OrganizerSessionEf>
{
    public void Configure(EntityTypeBuilder<OrganizerSessionEf> builder)
    {
        builder.ToTable("organizer_sessions");
        builder.HasKey(e => e.Id);
        builder.HasOne(e => e.Organizer)
            .WithMany(o => o.Sessions)
            .HasForeignKey(e => e.OrganizerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
