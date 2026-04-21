using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Converters;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class SessionStateEfConfiguration : IEntityTypeConfiguration<SessionStateEf>
{
    private static readonly ValueComparer<List<string>> StringListComparer =
        new(
            (a, b) => AreEqual(a, b),
            v => GetHash(v),
            v => Snapshot(v));

    public void Configure(EntityTypeBuilder<SessionStateEf> builder)
    {
        builder.ToTable("session_states");
        builder.HasKey(e => e.PartyId);
        builder.HasQueryFilter(e => !e.Party.IsDeleted);
        builder.Property(e => e.Status).IsRequired().HasMaxLength(20);
        builder.Property(e => e.Mode).IsRequired().HasMaxLength(20);
        var playedTrackIdsProperty = builder.Property(e => e.PlayedTrackIds)
            .HasConversion(new StringListConverter())
            .HasColumnType("jsonb");
        playedTrackIdsProperty.Metadata.SetValueComparer(StringListComparer);

        var disabledTrackIdsProperty = builder.Property(e => e.DisabledTrackIds)
            .HasConversion(new StringListConverter())
            .HasColumnType("jsonb");
        disabledTrackIdsProperty.Metadata.SetValueComparer(StringListComparer);

        var disabledGroupIdsProperty = builder.Property(e => e.DisabledGroupIds)
            .HasConversion(new StringListConverter())
            .HasColumnType("jsonb");
        disabledGroupIdsProperty.Metadata.SetValueComparer(StringListComparer);
        builder.HasOne(e => e.Party)
            .WithOne(p => p.SessionState)
            .HasForeignKey<SessionStateEf>(e => e.PartyId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static bool AreEqual(List<string>? left, List<string>? right) =>
        (left ?? new List<string>()).SequenceEqual(right ?? new List<string>());

    private static int GetHash(List<string>? value)
    {
        var hash = new HashCode();
        foreach (var item in value ?? new List<string>())
        {
            hash.Add(item);
        }

        return hash.ToHashCode();
    }

    private static List<string> Snapshot(List<string>? value) =>
        value == null ? new List<string>() : value.ToList();
}
