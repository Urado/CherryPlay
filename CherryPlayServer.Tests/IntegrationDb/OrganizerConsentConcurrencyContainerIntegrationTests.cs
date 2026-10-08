using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Repositories;
using CherryPlayServer.Models;
using Microsoft.EntityFrameworkCore;

namespace CherryPlayServer.Tests.IntegrationDb;

[TestFixture]
[NonParallelizable]
[Category("ContainerIntegration")]
public sealed class OrganizerConsentConcurrencyContainerIntegrationTests
{
    private static readonly Guid PdVersionId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TermsVersionId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private const string PdHash = "1ec5bcae20671f7083e7a3a58525d7d628c7aa1b6b20c0462aea46a09ccd5f6f";
    private const string TermsHash = "c9290febb6dce3229775dba33b7a766a09f769963f82331ccd34dc274f32334d";

    [Test]
    public async Task Registration_ConcurrentSameEmailCreatesOneOrganizerAndConsentSet()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
        }
        var request = CreateRegistrationRequest($"parallel-{Guid.NewGuid():N}@example.invalid");

        var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(async _ =>
        {
            await using var db = new AppDbContext(options);
            return await CreateOrganizersService(db).RegisterAsync(request);
        }));

        Assert.That(results[0].Id, Is.EqualTo(results[1].Id));
        await using var verifyDb = new AppDbContext(options);
        Assert.That(await verifyDb.EmailAccounts.CountAsync(item => item.Email == request.Email), Is.EqualTo(1));
        Assert.That(await verifyDb.Organizers.IgnoreQueryFilters().CountAsync(item => item.Id == results[0].Id), Is.EqualTo(1));
        Assert.That(await verifyDb.ConsentEvents.CountAsync(item => item.SubjectId == results[0].Id), Is.EqualTo(2));
    }

    [Test]
    public async Task ConsentEvents_ParallelSameIdAndPayloadPersistsOneEvent()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        var organizerId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
            db.Organizers.Add(new OrganizerEf { Id = organizerId, Name = "Consent subject", Role = "organizer", CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }
        var request = new CreateConsentEventsRequest([
            new ConsentInputDto(eventId, PdVersionId, PdHash, ConsentDecision.Grant)
        ]);

        var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(async _ =>
        {
            await using var db = new AppDbContext(options);
            return await CreateConsentEventsService(db).CreateAsync(organizerId, request);
        }));

        Assert.That(results.All(items => items.Single().Id == eventId), Is.True);
        await using var verifyDb = new AppDbContext(options);
        Assert.That(await verifyDb.ConsentEvents.CountAsync(item => item.Id == eventId), Is.EqualTo(1));
    }

    [Test]
    public async Task ConsentEvents_ConflictingBatchDoesNotPersistNonConflictingItems()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        var organizerId = Guid.NewGuid();
        var collisionId = Guid.NewGuid();
        var newId = Guid.NewGuid();
        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
            db.Organizers.Add(new OrganizerEf { Id = organizerId, Name = "Consent subject", Role = "organizer", CreatedAt = DateTime.UtcNow });
            db.ConsentEvents.Add(new ConsentEventEf
            {
                Id = collisionId,
                SubjectId = organizerId,
                LegalDocumentVersionId = PdVersionId,
                DocumentHash = PdHash,
                Decision = "grant",
                EventAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }
        await using (var db = new AppDbContext(options))
        {
            var service = CreateConsentEventsService(db);
            Assert.ThrowsAsync<CherryPlayServer.Core.Exceptions.LegalConsentException>(() => service.CreateAsync(
                organizerId,
                new CreateConsentEventsRequest([
                    new ConsentInputDto(collisionId, PdVersionId, PdHash, ConsentDecision.Withdraw),
                    new ConsentInputDto(newId, TermsVersionId, TermsHash, ConsentDecision.Grant)
                ])));
        }

        await using var verifyDb = new AppDbContext(options);
        Assert.That(await verifyDb.ConsentEvents.CountAsync(item => item.Id == collisionId), Is.EqualTo(1));
        Assert.That(await verifyDb.ConsentEvents.AnyAsync(item => item.Id == newId), Is.False);
    }

    private static DbContextOptions<AppDbContext> CreateOptions(string connectionString) =>
        new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;

    private static RegisterOrganizerRequest CreateRegistrationRequest(string email) => new(
        email,
        "password1",
        "Parallel organizer",
        [
            new ConsentInputDto(Guid.NewGuid(), PdVersionId, PdHash, ConsentDecision.Grant),
            new ConsentInputDto(Guid.NewGuid(), TermsVersionId, TermsHash, ConsentDecision.Grant)
        ]);

    private static OrganizersService CreateOrganizersService(AppDbContext db)
    {
        var organizers = new EfOrganizerRepository(db);
        var emails = new EfEmailAccountRepository(db);
        var oauthAccounts = new EfOAuthAccountRepository(db);
        var events = new EfConsentEventRepository(db);
        var versions = new EfLegalDocumentVersionRepository(db);
        var unitOfWork = new EfLegalConsentUnitOfWork(db, organizers, emails, oauthAccounts, events, versions);
        var legalDocuments = new LegalDocumentsService(versions, events);
        var consentEvents = new ConsentEventsService(legalDocuments, events, unitOfWork);
        return new OrganizersService(unitOfWork, legalDocuments, new PasswordHasher(), consentEvents);
    }

    private static ConsentEventsService CreateConsentEventsService(AppDbContext db)
    {
        var events = new EfConsentEventRepository(db);
        var versions = new EfLegalDocumentVersionRepository(db);
        var unitOfWork = new EfLegalConsentUnitOfWork(
            db,
            new EfOrganizerRepository(db),
            new EfEmailAccountRepository(db),
            new EfOAuthAccountRepository(db),
            events,
            versions);
        var legalDocuments = new LegalDocumentsService(versions, events);
        return new ConsentEventsService(legalDocuments, events, unitOfWork);
    }
}
