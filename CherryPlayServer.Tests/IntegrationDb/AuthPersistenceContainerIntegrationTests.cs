using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Npgsql;

namespace CherryPlayServer.Tests.IntegrationDb;

[TestFixture]
[NonParallelizable]
[Category("ContainerIntegration")]
public sealed class AuthPersistenceContainerIntegrationTests
{
    [Test]
    public async Task AccountDeletion_WhenOrganizerUpdateFails_RestoresEarlierCredentialAndSessionDeletes()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        var organizerId = Guid.NewGuid();
        var emailId = Guid.NewGuid();
        var oauthId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
            db.Organizers.Add(new OrganizerEf
            {
                Id = organizerId,
                Name = "Delete rollback organizer",
                Role = "organizer",
                CreatedAt = DateTime.UtcNow,
                LogoUrl = "https://example.invalid/logo.png"
            });
            db.EmailAccounts.Add(new EmailAccountEf
            {
                Id = emailId,
                OrganizerId = organizerId,
                Email = $"delete-{Guid.NewGuid():N}@example.invalid",
                PasswordHash = "password-hash",
                CreatedAt = DateTime.UtcNow
            });
            db.OAuthAccounts.Add(new OAuthAccountEf
            {
                Id = oauthId,
                OrganizerId = organizerId,
                Provider = "vk",
                ProviderUserId = Guid.NewGuid().ToString("N"),
                CreatedAt = DateTime.UtcNow
            });
            db.OrganizerSessions.Add(new OrganizerSessionEf
            {
                Id = sessionId,
                OrganizerId = organizerId,
                CreatedAt = DateTime.UtcNow
            });
            db.Parties.Add(new PartyEf
            {
                Id = partyId,
                OrganizerId = organizerId,
                Name = "Preserved party",
                ShortCode = $"D{Guid.NewGuid():N}"[..7],
                PartyThemeId = "basic",
                CreatedAt = DateTime.UtcNow,
                PartyLifecycleState = CherryPlayServer.Core.Enums.PartyLifecycleState.Ready
            });
            await db.SaveChangesAsync();
        }
        await InstallOrganizerUpdateFailureTriggerAsync(database.ConnectionString);

        await using (var db = new AppDbContext(options))
        {
            var organizers = new EfOrganizerRepository(db);
            var emails = new EfEmailAccountRepository(db);
            var oauth = new EfOAuthAccountRepository(db);
            var sessions = new EfOrganizerSessionRepository(db);
            var eventRepository = new EfConsentEventRepository(db);
            var versions = new EfLegalDocumentVersionRepository(db);
            var legalUnitOfWork = new EfLegalConsentUnitOfWork(db, organizers, emails, oauth, eventRepository, versions);
            var consentEvents = new ConsentEventsService(new LegalDocumentsService(versions, eventRepository), eventRepository, legalUnitOfWork);
            var appUnitOfWork = new EfAppUnitOfWork(db, organizers, emails, oauth, sessions);
            var service = new OrganizerService(organizers, appUnitOfWork, consentEvents, NullLogger<OrganizerService>.Instance);

            Assert.ThrowsAsync<DbUpdateException>(() => service.DeleteAccountAsync(organizerId));
        }

        await using var verifyDb = new AppDbContext(options);
        var savedOrganizer = await verifyDb.Organizers.SingleAsync(item => item.Id == organizerId);
        Assert.That(savedOrganizer.Name, Is.EqualTo("Delete rollback organizer"));
        Assert.That(savedOrganizer.LogoUrl, Is.EqualTo("https://example.invalid/logo.png"));
        Assert.That(savedOrganizer.IsDeleted, Is.False);
        Assert.That(await verifyDb.EmailAccounts.AnyAsync(item => item.Id == emailId), Is.True);
        Assert.That(await verifyDb.OAuthAccounts.AnyAsync(item => item.Id == oauthId), Is.True);
        Assert.That(await verifyDb.OrganizerSessions.AnyAsync(item => item.Id == sessionId), Is.True);
        Assert.That(await verifyDb.Parties.AnyAsync(item => item.Id == partyId), Is.True);
    }

    [Test]
    public async Task PasswordReset_ConcurrentRequestsChangePasswordAndInvalidateSessionsOnce()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        var organizerId = Guid.NewGuid();
        var emailAccountId = Guid.NewGuid();
        var resetTokenId = Guid.NewGuid();
        var secondaryTokenId = Guid.NewGuid();
        const string rawToken = "shared-reset-token";
        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
            db.Organizers.Add(new OrganizerEf { Id = organizerId, Name = "Reset organizer", Role = "organizer", CreatedAt = DateTime.UtcNow });
            db.EmailAccounts.Add(new EmailAccountEf
            {
                Id = emailAccountId,
                OrganizerId = organizerId,
                Email = $"reset-service-{Guid.NewGuid():N}@example.invalid",
                PasswordHash = "hash:old-password",
                CreatedAt = DateTime.UtcNow
            });
            db.PasswordResetTokens.AddRange(
                new PasswordResetTokenEf
                {
                    Id = resetTokenId,
                    EmailAccountId = emailAccountId,
                    TokenHash = PasswordResetTokenHelper.HashToken(rawToken),
                    ExpiresAt = DateTime.UtcNow.AddMinutes(10),
                    CreatedAt = DateTime.UtcNow
                },
                new PasswordResetTokenEf
                {
                    Id = secondaryTokenId,
                    EmailAccountId = emailAccountId,
                    TokenHash = Guid.NewGuid().ToString("N"),
                    ExpiresAt = DateTime.UtcNow.AddMinutes(10),
                    CreatedAt = DateTime.UtcNow
                });
            db.OrganizerSessions.AddRange(
                new OrganizerSessionEf { Id = Guid.NewGuid(), OrganizerId = organizerId, CreatedAt = DateTime.UtcNow },
                new OrganizerSessionEf { Id = Guid.NewGuid(), OrganizerId = organizerId, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }

        var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(async _ =>
        {
            await using var db = new AppDbContext(options);
            return await CreateAuthService(db).ResetPasswordAsync(rawToken, "new-password");
        }));

        Assert.That(results.Count(result => result.Success), Is.EqualTo(1));
        await using var verifyDb = new AppDbContext(options);
        var savedAccount = await verifyDb.EmailAccounts.SingleAsync(item => item.Id == emailAccountId);
        Assert.That(savedAccount.PasswordHash, Is.EqualTo("hash:new-password"));
        Assert.That(await verifyDb.OrganizerSessions.CountAsync(item => item.OrganizerId == organizerId), Is.Zero);
        Assert.That(await verifyDb.PasswordResetTokens.Where(item => item.EmailAccountId == emailAccountId && item.UsedAt != null).CountAsync(), Is.EqualTo(2));
    }

    [Test]
    public async Task DesktopCodeExchange_ConcurrentRequestsIssueOneTokenAndCreateOneSession()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        var organizerId = Guid.NewGuid();
        var codeId = Guid.NewGuid();
        const string rawCode = "shared-desktop-code";
        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
            db.Organizers.Add(new OrganizerEf { Id = organizerId, Name = "Desktop exchange organizer", Role = "organizer", CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            await new EfDesktopAuthCodeRepository(db).AddAsync(new DesktopAuthCode
            {
                Id = codeId,
                OrganizerId = organizerId,
                TokenHash = PasswordResetTokenHelper.HashToken(rawCode),
                ExpiresAt = DateTime.UtcNow.AddMinutes(3),
                CreatedAt = DateTime.UtcNow
            });
        }

        var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(async _ =>
        {
            await using var db = new AppDbContext(options);
            var sessions = new EfOrganizerSessionRepository(db);
            var service = new DesktopAuthCodeService(
                new EfDesktopAuthCodeRepository(db),
                new EfOrganizerRepository(db),
                new DatabaseBackedSessionAuthService(sessions));
            return await service.ExchangeAsync(rawCode);
        }));

        Assert.That(results.Count(token => token is not null), Is.EqualTo(1));
        await using var verifyDb = new AppDbContext(options);
        Assert.That(await verifyDb.OrganizerSessions.CountAsync(item => item.OrganizerId == organizerId), Is.EqualTo(1));
        Assert.That(await verifyDb.DesktopAuthCodes.Where(item => item.Id == codeId).Select(item => item.UsedAt).SingleAsync(), Is.Not.Null);
    }

    private static DbContextOptions<AppDbContext> CreateOptions(string connectionString) =>
        new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;

    private static AuthService CreateAuthService(AppDbContext db)
    {
        var organizerRepository = new EfOrganizerRepository(db);
        var sessions = new EfOrganizerSessionRepository(db);
        var oauth = new UnusedOAuthAccountRepository();
        var emails = new EfEmailAccountRepository(db);
        var resetTokens = new EfPasswordResetTokenRepository(db);
        var passwordHasher = new FastPasswordHasher();
        return new AuthService(
            organizerRepository,
            sessions,
            oauth,
            emails,
            resetTokens,
            new EfPasswordResetApplicator(db),
            passwordHasher,
            new UnusedOAuthService(),
            new UnusedJwtService(),
            new RecordingEmailSender(isConfigured: false),
            Options.Create(new CherryPlayServer.Core.Options.EmailOptions()),
            new FakeHostEnvironment(Environments.Development),
            NullLogger<AuthService>.Instance);
    }

    private static async Task InstallOrganizerUpdateFailureTriggerAsync(string connectionString)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var function = connection.CreateCommand();
        function.CommandText = "CREATE FUNCTION reject_organizer_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced organizer update failure'; END; $$";
        await function.ExecuteNonQueryAsync();
        await using var trigger = connection.CreateCommand();
        trigger.CommandText = "CREATE TRIGGER reject_organizer_update BEFORE UPDATE ON organizers FOR EACH ROW EXECUTE FUNCTION reject_organizer_update()";
        await trigger.ExecuteNonQueryAsync();
    }
}
