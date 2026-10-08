using CherryPlayServer.Core;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Tests.IntegrationDb;

[TestFixture]
[NonParallelizable]
[Category("IntegrationDb")]
public sealed class PasswordResetTokenRetentionInvalidationEfTests
{
    private PostgresContainerFixture? _postgresFixture;

    [OneTimeSetUp]
    public async Task OneTimeSetUp()
    {
        _postgresFixture = new PostgresContainerFixture();
        await _postgresFixture.InitializeAsync();
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown()
    {
        if (_postgresFixture is not null)
        {
            await _postgresFixture.DisposeAsync();
        }
    }

    [Test]
    public async Task InvalidateUnused_DoesNotMarkExpiredTokenAndExpiryCleanupRemovesIt()
    {
        var fixture = _postgresFixture ?? throw new InvalidOperationException("PostgreSQL fixture is not initialized.");
        var connectionString = await fixture.CreateFreshDatabaseConnectionStringAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;
        await using var db = new AppDbContext(options);
        await db.Database.MigrateAsync();

        var organizerId = Guid.NewGuid();
        var emailAccountId = Guid.NewGuid();
        db.Organizers.Add(new OrganizerEf
        {
            Id = organizerId,
            Name = "retention-invalidation",
            Role = "organizer",
            CreatedAt = DateTime.UtcNow,
        });
        db.EmailAccounts.Add(new EmailAccountEf
        {
            Id = emailAccountId,
            OrganizerId = organizerId,
            Email = "retention-invalidation@example.com",
            PasswordHash = "hash",
            CreatedAt = DateTime.UtcNow,
        });

        var now = DateTime.UtcNow;
        var expiredOldId = Guid.NewGuid();
        var activeId = Guid.NewGuid();
        db.PasswordResetTokens.AddRange(
            new PasswordResetTokenEf
            {
                Id = expiredOldId,
                EmailAccountId = emailAccountId,
                TokenHash = PasswordResetTokenHelper.HashToken("expired-old-invalidation"),
                ExpiresAt = now.AddDays(-31),
                CreatedAt = now.AddDays(-32),
            },
            new PasswordResetTokenEf
            {
                Id = activeId,
                EmailAccountId = emailAccountId,
                TokenHash = PasswordResetTokenHelper.HashToken("active-invalidation"),
                ExpiresAt = now.AddHours(1),
                CreatedAt = now,
            });
        await db.SaveChangesAsync();

        var repository = new EfPasswordResetTokenRepository(db);
        await repository.InvalidateUnusedByEmailAccountIdAsync(emailAccountId);

        Assert.That(await db.PasswordResetTokens.Where(token => token.Id == expiredOldId).Select(token => token.UsedAt).SingleAsync(), Is.Null);
        Assert.That(await db.PasswordResetTokens.Where(token => token.Id == activeId).Select(token => token.UsedAt).SingleAsync(), Is.Not.Null);

        var deleted = await repository.DeleteStaleAsync(now, AuthConstants.PasswordResetTokenRecordRetention);

        Assert.That(deleted, Is.EqualTo(1));
        Assert.That(await db.PasswordResetTokens.AnyAsync(token => token.Id == expiredOldId), Is.False);
        Assert.That(await db.PasswordResetTokens.AnyAsync(token => token.Id == activeId), Is.True);
    }
}
