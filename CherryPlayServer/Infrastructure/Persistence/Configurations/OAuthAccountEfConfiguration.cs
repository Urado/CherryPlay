using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using CherryPlayServer.Infrastructure.Persistence.Entities;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class OAuthAccountEfConfiguration : IEntityTypeConfiguration<OAuthAccountEf>
{
    public void Configure(EntityTypeBuilder<OAuthAccountEf> builder)
    {
        builder.ToTable("oauth_accounts");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Provider).IsRequired().HasMaxLength(50);
        builder.Property(e => e.ProviderUserId).IsRequired().HasMaxLength(256);
        builder.HasIndex(e => new { e.Provider, e.ProviderUserId }).IsUnique();
        builder.HasOne(e => e.Organizer)
            .WithMany(o => o.OAuthAccounts)
            .HasForeignKey(e => e.OrganizerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
