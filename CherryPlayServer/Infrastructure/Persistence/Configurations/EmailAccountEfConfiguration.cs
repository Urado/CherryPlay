using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using CherryPlayServer.Infrastructure.Persistence.Entities;

namespace CherryPlayServer.Infrastructure.Persistence.Configurations;

public class EmailAccountEfConfiguration : IEntityTypeConfiguration<EmailAccountEf>
{
    public void Configure(EntityTypeBuilder<EmailAccountEf> builder)
    {
        builder.ToTable("email_accounts");
        builder.HasKey(e => e.Id);
        builder.HasQueryFilter(e => !e.Organizer.IsDeleted);
        builder.Property(e => e.Email).IsRequired().HasMaxLength(256);
        builder.Property(e => e.PasswordHash).IsRequired();
        builder.HasIndex(e => e.Email).IsUnique();
        builder.HasOne(e => e.Organizer)
            .WithMany(o => o.EmailAccounts)
            .HasForeignKey(e => e.OrganizerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
