using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using CherryPlayServer.Infrastructure.Persistence.Entities;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class PasswordResetTokenEfConfiguration : IEntityTypeConfiguration<PasswordResetTokenEf>
{
    public void Configure(EntityTypeBuilder<PasswordResetTokenEf> builder)
    {
        builder.ToTable("password_reset_tokens");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.TokenHash).IsRequired().HasMaxLength(64);
        builder.HasIndex(e => e.TokenHash).IsUnique();
        builder.HasIndex(e => e.EmailAccountId);
        builder.HasOne(e => e.EmailAccount)
            .WithMany()
            .HasForeignKey(e => e.EmailAccountId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
