using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using CherryPlayServer.Core.Options;

namespace CherryPlayServer.Tests;

public class PartyListLifecycleFilterTests
{
    [Test]
    public async Task GetPartiesByOrganizer_ExcludesDraftParties()
    {
        var organizerId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await SeedParty(repository, organizerId, PartyLifecycleState.Draft, "DRAFT1");
        await SeedParty(repository, organizerId, PartyLifecycleState.Ready, "READY1");
        var service = CreatePartyService(organizerId, repository);

        var result = await service.GetPartiesByOrganizerAsync();

        Assert.That(result, Has.Count.EqualTo(1));
        Assert.That(result[0].ShortCode, Is.EqualTo("READY1"));
        Assert.That(result[0].PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
    }

    [Test]
    public async Task GetAllPublicParties_ExcludesDraftEvenWhenListedInCatalog()
    {
        var organizerId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await SeedParty(repository, organizerId, PartyLifecycleState.Draft, "DRAFT2", listedInCatalog: true);
        await SeedParty(repository, organizerId, PartyLifecycleState.Ready, "READY2", listedInCatalog: true);
        var service = CreatePublicPartyQueryService(repository);

        var result = await service.GetAllPublicPartiesAsync();

        Assert.That(result, Has.Count.EqualTo(1));
        Assert.That(result[0].ShortCode, Is.EqualTo("READY2"));
    }

    [Test]
    public async Task GetPartyAsync_ReturnsDraftPartyForOrganizer()
    {
        var organizerId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        var partyId = await SeedParty(repository, organizerId, PartyLifecycleState.Draft, "DRAFT3");
        var service = CreatePartyService(organizerId, repository);

        var result = await service.GetPartyAsync(partyId);

        Assert.That(result, Is.Not.Null);
        Assert.That(result!.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Draft));
        Assert.That(result.ShortCode, Is.EqualTo("DRAFT3"));
    }

    [Test]
    public async Task CreateParty_ReturnsReadyLifecycleState()
    {
        var organizerId = Guid.NewGuid();
        var service = CreatePartyService(organizerId, new InMemoryPartyRepository());

        var result = await service.CreatePartyAsync(new CreatePartyDto
        {
            Name = "New Ready Party",
            PartyThemeId = PartyThemeId.Basic,
        });

        Assert.That(result.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
        Assert.That(result.IsListedInCatalog, Is.False);
    }

    [Test]
    public async Task GetAllPartiesAsync_ExcludesDraftParties()
    {
        var organizerId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await SeedParty(repository, organizerId, PartyLifecycleState.Draft, "DRAFT4");
        await SeedParty(repository, organizerId, PartyLifecycleState.Completed, "DONE01");
        var service = CreatePartyService(organizerId, repository);

        var result = await service.GetAllPartiesAsync();

        Assert.That(result, Has.Count.EqualTo(1));
        Assert.That(result[0].ShortCode, Is.EqualTo("DONE01"));
    }

    [Test]
    public async Task GetPublicPartyByShortCode_ReturnsDraftParty()
    {
        var organizerId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await SeedParty(repository, organizerId, PartyLifecycleState.Draft, "DRFT99");
        var service = CreatePublicPartyQueryService(repository);

        var result = await service.GetPublicPartyAsync("DRFT99");

        Assert.That(result, Is.Not.Null);
        Assert.That(result!.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Draft));
    }

    private static async Task<Guid> SeedParty(
        InMemoryPartyRepository repository,
        Guid organizerId,
        PartyLifecycleState lifecycleState,
        string shortCode,
        bool listedInCatalog = false)
    {
        var partyId = Guid.NewGuid();
        await repository.AddAsync(new Party
        {
            Id = partyId,
            OrganizerId = organizerId,
            Name = $"Party {shortCode}",
            ShortCode = shortCode,
            PartyThemeId = PartyThemeId.Basic,
            Playlist = new PartyPlaylist(),
            CreatedAt = DateTime.UtcNow,
            PartyLifecycleState = lifecycleState,
            IsListedInCatalog = listedInCatalog,
        });
        return partyId;
    }

    private static PublicPartyQueryService CreatePublicPartyQueryService(InMemoryPartyRepository repository) =>
        new(
            repository,
            new InMemoryStreamingRepository(),
            new PartyDisplayStatusService(
                new OrganizerConnectionTracker(),
                Options.Create(new PartyDisplayStatusOptions())),
            NullLogger<PublicPartyQueryService>.Instance);

    private static PartyService CreatePartyService(Guid organizerId, IPartyRepository partyRepository)
    {
        var contextAccessor = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext(),
        };
        contextAccessor.HttpContext.Items["OrganizerId"] = organizerId;

        return new PartyService(
            partyRepository,
            new InMemoryStreamingRepository(),
            new FixedShortCodeGenerator(),
            contextAccessor,
            new NoOpPlaylistNotifier(),
            new PartyAccessService(partyRepository, NullLogger<PartyAccessService>.Instance),
            new PermissiveThemeAccessService(),
            NullLogger<PartyService>.Instance);
    }

    private sealed class FixedShortCodeGenerator : IShortCodeGenerator
    {
        public Task<string> GenerateUniqueShortCodeAsync(Func<string, Task<bool>> uniquenessChecker, int maxRetries = 10) =>
            Task.FromResult("AUTO99");
    }

    private sealed class NoOpPlaylistNotifier : IPartyPlaylistNotifier
    {
        public Task NotifyPlaylistChangedAsync(Guid partyId) => Task.CompletedTask;
    }

    private sealed class PermissiveThemeAccessService : IThemeAccessService
    {
        public Task<ThemeAccessSummary> GetAccessSummaryAsync(Guid organizerId) =>
            Task.FromResult(new ThemeAccessSummary([], [], "https://vk.com/<owner>"));

        public Task<ThemeAccessCheckResult> CheckThemeAccessAsync(Guid organizerId, string themeId) =>
            Task.FromResult(new ThemeAccessCheckResult(true, true, []));
    }
}
