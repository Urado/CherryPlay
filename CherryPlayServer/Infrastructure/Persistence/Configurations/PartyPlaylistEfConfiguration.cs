using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using System.Text.Json;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Converters;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class PartyPlaylistEfConfiguration : IEntityTypeConfiguration<PartyPlaylistEf>
{
    private static readonly ValueComparer<List<Core.Entities.PlayerItem>> PlayerItemListComparer =
        new(
            (a, b) => AreEqual(a, b),
            v => GetHash(v),
            v => Snapshot(v));

    public void Configure(EntityTypeBuilder<PartyPlaylistEf> builder)
    {
        builder.ToTable("party_playlists");
        builder.HasKey(e => e.PartyId);
        builder.HasQueryFilter(e => !e.Party.IsDeleted);
        var itemsProperty = builder.Property(e => e.Items)
            .HasConversion(new PlayerItemListConverter())
            .HasColumnType("jsonb");
        itemsProperty.Metadata.SetValueComparer(PlayerItemListComparer);
        builder.HasOne(e => e.Party)
            .WithOne(p => p.Playlist)
            .HasForeignKey<PartyPlaylistEf>(e => e.PartyId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static bool AreEqual(List<Core.Entities.PlayerItem>? left, List<Core.Entities.PlayerItem>? right) =>
        JsonSerializer.Serialize(left ?? new List<Core.Entities.PlayerItem>()) ==
        JsonSerializer.Serialize(right ?? new List<Core.Entities.PlayerItem>());

    private static int GetHash(List<Core.Entities.PlayerItem>? value) =>
        JsonSerializer.Serialize(value ?? new List<Core.Entities.PlayerItem>()).GetHashCode();

    private static List<Core.Entities.PlayerItem> Snapshot(List<Core.Entities.PlayerItem>? value) =>
        JsonSerializer.Deserialize<List<Core.Entities.PlayerItem>>(
            JsonSerializer.Serialize(value ?? new List<Core.Entities.PlayerItem>()))
        ?? new List<Core.Entities.PlayerItem>();
}
