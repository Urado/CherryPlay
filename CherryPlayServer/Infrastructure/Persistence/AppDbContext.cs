using Microsoft.EntityFrameworkCore;
using CherryPlayServer.Infrastructure.Persistence.Entities;

namespace CherryPlayServer.Infrastructure.Persistence;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<OrganizerEf> Organizers => Set<OrganizerEf>();
    public DbSet<PartyEf> Parties => Set<PartyEf>();
    public DbSet<PartyPlaylistEf> PartyPlaylists => Set<PartyPlaylistEf>();
    public DbSet<SessionStateEf> SessionStates => Set<SessionStateEf>();
    public DbSet<EmailAccountEf> EmailAccounts => Set<EmailAccountEf>();
    public DbSet<OAuthAccountEf> OAuthAccounts => Set<OAuthAccountEf>();
    public DbSet<OrganizerSessionEf> OrganizerSessions => Set<OrganizerSessionEf>();
    public DbSet<PasswordResetTokenEf> PasswordResetTokens => Set<PasswordResetTokenEf>();
    public DbSet<ThemeEf> Themes => Set<ThemeEf>();
    public DbSet<ThemePackageEf> ThemePackages => Set<ThemePackageEf>();
    public DbSet<ThemePackageItemEf> ThemePackageItems => Set<ThemePackageItemEf>();
    public DbSet<OrganizerEntitlementEf> OrganizerEntitlements => Set<OrganizerEntitlementEf>();
    public DbSet<AdminAuditLogEf> AdminAuditLogs => Set<AdminAuditLogEf>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        modelBuilder.Entity<OrganizerEf>().HasQueryFilter(e => !e.IsDeleted);
        modelBuilder.Entity<PartyEf>().HasQueryFilter(e => !e.IsDeleted);
    }
}
