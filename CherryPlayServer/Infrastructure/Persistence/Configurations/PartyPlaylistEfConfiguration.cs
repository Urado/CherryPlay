using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Converters;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class PartyPlaylistEfConfiguration : IEntityTypeConfiguration<PartyPlaylistEf>
{
    public void Configure(EntityTypeBuilder<PartyPlaylistEf> builder)
    {
        builder.ToTable("party_playlists");
        builder.HasKey(e => e.PartyId);
        builder.Property(e => e.Items)
            .HasConversion(new PlayerItemListConverter())
            .HasColumnType("jsonb");
        builder.HasOne(e => e.Party)
            .WithOne(p => p.Playlist)
            .HasForeignKey<PartyPlaylistEf>(e => e.PartyId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
