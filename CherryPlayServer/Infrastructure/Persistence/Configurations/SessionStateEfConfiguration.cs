using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Converters;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class SessionStateEfConfiguration : IEntityTypeConfiguration<SessionStateEf>
{
    public void Configure(EntityTypeBuilder<SessionStateEf> builder)
    {
        builder.ToTable("session_states");
        builder.HasKey(e => e.PartyId);
        builder.Property(e => e.Status).IsRequired().HasMaxLength(20);
        builder.Property(e => e.Mode).IsRequired().HasMaxLength(20);
        builder.Property(e => e.PlayedTrackIds)
            .HasConversion(new StringListConverter())
            .HasColumnType("jsonb");
        builder.Property(e => e.DisabledTrackIds)
            .HasConversion(new StringListConverter())
            .HasColumnType("jsonb");
        builder.Property(e => e.DisabledGroupIds)
            .HasConversion(new StringListConverter())
            .HasColumnType("jsonb");
        builder.HasOne(e => e.Party)
            .WithOne(p => p.SessionState)
            .HasForeignKey<SessionStateEf>(e => e.PartyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
