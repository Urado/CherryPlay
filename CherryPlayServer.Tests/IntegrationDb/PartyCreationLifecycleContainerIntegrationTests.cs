using CherryPlayServer.Core;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Repositories;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests.IntegrationDb;

[TestFixture]
[NonParallelizable]
[Category("ContainerIntegration")]
public sealed class PartyCreationLifecycleContainerIntegrationTests
{
    [Test]
    public async Task CreateParty_PersistsReadyLifecycleForFollowUpRead()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(database.ConnectionString)
            .UseSnakeCaseNamingConvention()
            .Options;
        var organizerId = Guid.NewGuid();

        await using (var setupDb = new AppDbContext(options))
        {
            await setupDb.Database.MigrateAsync();
            setupDb.Organizers.Add(new OrganizerEf
            {
                Id = organizerId,
                Name = "Lifecycle integration organizer",
                Role = "organizer",
                CreatedAt = DateTime.UtcNow,
            });
            await setupDb.SaveChangesAsync();
        }

        PartyDto created;
        await using (var createDb = new AppDbContext(options))
        {
            var repository = new EfPartyRepository(createDb, NullLogger<EfPartyRepository>.Instance);
            var service = CreatePartyService(organizerId, createDb, repository);
            created = await service.CreatePartyAsync(new CreatePartyDto
            {
                Name = "New lifecycle party",
                PartyThemeId = PartyThemeDefaults.Id,
            });
        }

        Assert.That(created.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));

        await using var readDb = new AppDbContext(options);
        var readRepository = new EfPartyRepository(readDb, NullLogger<EfPartyRepository>.Instance);
        var loaded = await readRepository.GetByIdAsync(Guid.Parse(created.Id));

        Assert.That(loaded, Is.Not.Null);
        Assert.That(loaded!.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));

        var readService = CreatePartyService(organizerId, readDb, readRepository);
        var fetched = await readService.GetPartyAsync(Guid.Parse(created.Id));

        Assert.That(fetched, Is.Not.Null);
        Assert.That(fetched!.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
    }

    private static PartyService CreatePartyService(
        Guid organizerId,
        AppDbContext db,
        EfPartyRepository repository)
    {
        var httpContext = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
        httpContext.HttpContext!.Items["OrganizerId"] = organizerId;

        return new PartyService(
            repository,
            new EfStreamingRepository(db),
            new RegressionShortCodeGenerator(),
            httpContext,
            new RegressionPlaylistNotifier(),
            new PartyAccessService(repository, NullLogger<PartyAccessService>.Instance),
            new RegressionThemeAccessService(),
            NullLogger<PartyService>.Instance);
    }
}
