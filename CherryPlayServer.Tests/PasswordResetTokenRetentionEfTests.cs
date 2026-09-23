using CherryPlayServer.Core;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Repositories;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Tests;

public class PasswordResetTokenRetentionEfTests
{
    [Test]
    public async Task EfRepository_DeleteStale_KeepsActiveAndYoung_DeletesOldUsedAndExpired()
    {
        var connectionString = $"Data Source=file:prt-retention-{Guid.NewGuid():N}?mode=memory&cache=shared";
        await using var keeperConnection = new SqliteConnection(connectionString);
        await keeperConnection.OpenAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;

        await using var db = new AppDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var organizerId = Guid.NewGuid();
        var emailAccountId = Guid.NewGuid();
        db.Organizers.Add(new OrganizerEf
        {
            Id = organizerId,
            Name = "retention-test",
            Role = "organizer",
            CreatedAt = DateTime.UtcNow,
        });
        db.EmailAccounts.Add(new EmailAccountEf
        {
            Id = emailAccountId,
            OrganizerId = organizerId,
            Email = "retention@example.com",
            PasswordHash = "hash",
            CreatedAt = DateTime.UtcNow,
        });

        var utcNow = DateTime.UtcNow;
        var activeId = Guid.NewGuid();
        var usedOldId = Guid.NewGuid();
        var expiredOldId = Guid.NewGuid();
        var usedYoungId = Guid.NewGuid();
        var expiredYoungId = Guid.NewGuid();

        db.PasswordResetTokens.AddRange(
            new PasswordResetTokenEf
            {
                Id = activeId,
                EmailAccountId = emailAccountId,
                TokenHash = PasswordResetTokenHelper.HashToken("ef-active"),
                ExpiresAt = utcNow.AddHours(1),
                CreatedAt = utcNow,
            },
            new PasswordResetTokenEf
            {
                Id = usedOldId,
                EmailAccountId = emailAccountId,
                TokenHash = PasswordResetTokenHelper.HashToken("ef-used-old"),
                ExpiresAt = utcNow.AddDays(-40),
                UsedAt = utcNow.AddDays(-31),
                CreatedAt = utcNow.AddDays(-40),
            },
            new PasswordResetTokenEf
            {
                Id = expiredOldId,
                EmailAccountId = emailAccountId,
                TokenHash = PasswordResetTokenHelper.HashToken("ef-expired-old"),
                ExpiresAt = utcNow.AddDays(-31),
                CreatedAt = utcNow.AddDays(-32),
            },
            new PasswordResetTokenEf
            {
                Id = usedYoungId,
                EmailAccountId = emailAccountId,
                TokenHash = PasswordResetTokenHelper.HashToken("ef-used-young"),
                ExpiresAt = utcNow.AddDays(-5),
                UsedAt = utcNow.AddDays(-10),
                CreatedAt = utcNow.AddDays(-11),
            },
            new PasswordResetTokenEf
            {
                Id = expiredYoungId,
                EmailAccountId = emailAccountId,
                TokenHash = PasswordResetTokenHelper.HashToken("ef-expired-young"),
                ExpiresAt = utcNow.AddDays(-10),
                CreatedAt = utcNow.AddDays(-11),
            });
        await db.SaveChangesAsync();

        var repo = new EfPasswordResetTokenRepository(db);
        var deleted = await repo.DeleteStaleAsync(utcNow, AuthConstants.PasswordResetTokenRecordRetention);
        Assert.That(deleted, Is.EqualTo(2));

        var remainingIds = await db.PasswordResetTokens.AsNoTracking().Select(t => t.Id).ToListAsync();
        Assert.That(remainingIds, Is.EquivalentTo(new[] { activeId, usedYoungId, expiredYoungId }));

        var secondPass = await repo.DeleteStaleAsync(utcNow, AuthConstants.PasswordResetTokenRecordRetention);
        Assert.That(secondPass, Is.EqualTo(0));
        Assert.That(await db.PasswordResetTokens.CountAsync(), Is.EqualTo(3));
    }

    [Test]
    public async Task EfRepository_DeleteStale_ExactCutoffBoundary_DeletesAtOrBefore_KeepsOneSecondFresher()
    {
        var connectionString = $"Data Source=file:prt-retention-boundary-{Guid.NewGuid():N}?mode=memory&cache=shared";
        await using var keeperConnection = new SqliteConnection(connectionString);
        await keeperConnection.OpenAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;

        await using var db = new AppDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var organizerId = Guid.NewGuid();
        var emailAccountId = Guid.NewGuid();
        db.Organizers.Add(new OrganizerEf
        {
            Id = organizerId,
            Name = "retention-boundary",
            Role = "organizer",
            CreatedAt = DateTime.UtcNow,
        });
        db.EmailAccounts.Add(new EmailAccountEf
        {
            Id = emailAccountId,
            OrganizerId = organizerId,
            Email = "boundary@example.com",
            PasswordHash = "hash",
            CreatedAt = DateTime.UtcNow,
        });

        var utcNow = new DateTime(2026, 9, 23, 12, 0, 0, DateTimeKind.Utc);
        var retention = AuthConstants.PasswordResetTokenRecordRetention;
        var cutoff = utcNow - retention;
        var usedAtCutoffId = Guid.NewGuid();
        var usedJustInsideId = Guid.NewGuid();
        var expiredAtCutoffId = Guid.NewGuid();
        var expiredJustInsideId = Guid.NewGuid();

        db.PasswordResetTokens.AddRange(
            new PasswordResetTokenEf
            {
                Id = usedAtCutoffId,
                EmailAccountId = emailAccountId,
                TokenHash = PasswordResetTokenHelper.HashToken("ef-used-at-cutoff"),
                ExpiresAt = cutoff.AddDays(-1),
                UsedAt = cutoff,
                CreatedAt = cutoff.AddDays(-1),
            },
            new PasswordResetTokenEf
            {
                Id = usedJustInsideId,
                EmailAccountId = emailAccountId,
                TokenHash = PasswordResetTokenHelper.HashToken("ef-used-just-inside"),
                ExpiresAt = cutoff.AddDays(-1),
                UsedAt = cutoff.AddSeconds(1),
                CreatedAt = cutoff.AddDays(-1),
            },
            new PasswordResetTokenEf
            {
                Id = expiredAtCutoffId,
                EmailAccountId = emailAccountId,
                TokenHash = PasswordResetTokenHelper.HashToken("ef-expired-at-cutoff"),
                ExpiresAt = cutoff,
                CreatedAt = cutoff.AddDays(-1),
            },
            new PasswordResetTokenEf
            {
                Id = expiredJustInsideId,
                EmailAccountId = emailAccountId,
                TokenHash = PasswordResetTokenHelper.HashToken("ef-expired-just-inside"),
                ExpiresAt = cutoff.AddSeconds(1),
                CreatedAt = cutoff.AddDays(-1),
            });
        await db.SaveChangesAsync();

        var repo = new EfPasswordResetTokenRepository(db);
        var deleted = await repo.DeleteStaleAsync(utcNow, retention);
        Assert.That(deleted, Is.EqualTo(2));

        var remainingIds = await db.PasswordResetTokens.AsNoTracking().Select(t => t.Id).ToListAsync();
        Assert.That(remainingIds, Is.EquivalentTo(new[] { usedJustInsideId, expiredJustInsideId }));
    }
}
