using CherryPlayServer.Core.Entities;

using CherryPlayServer.Core.Enums;

using CherryPlayServer.Core.Options;

using CherryPlayServer.Core.Services;

using CherryPlayServer.Infrastructure.Repositories;

using Microsoft.Extensions.Logging.Abstractions;

using Microsoft.Extensions.Options;



namespace CherryPlayServer.Tests;



[TestFixture]

public class PublicPartyQueryServiceDisplayStatusTests

{

    private static readonly Guid PartyId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");

    private static readonly Guid ListedReadyPartyId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");

    private static readonly DateTime Now = new(2026, 5, 29, 12, 0, 0, DateTimeKind.Utc);



    [Test]

    public async Task GetPublicPartyAsync_IncludesPartyDisplayStatus_ScheduledWhenReadyAndOffline()

    {

        var partyRepository = new InMemoryPartyRepository();

        var streamingRepository = new InMemoryStreamingRepository();

        await SeedPartyAsync(partyRepository, PartyLifecycleState.Ready, "PUB001");



        var service = CreateService(partyRepository, streamingRepository, new FakeOrganizerTracker());



        var result = await service.GetPublicPartyAsync("PUB001");



        Assert.That(result, Is.Not.Null);

        Assert.That(result!.PartyDisplayStatus, Is.EqualTo(PartyDisplayStatus.Scheduled));

    }



    [Test]

    public async Task GetPublicPartyAsync_ReturnsDraft_ForDraftLifecycle()

    {

        var partyRepository = new InMemoryPartyRepository();

        await SeedPartyAsync(partyRepository, PartyLifecycleState.Draft, "DRFTP1");



        var service = CreateService(partyRepository, new InMemoryStreamingRepository(), new FakeOrganizerTracker());



        var result = await service.GetPublicPartyAsync("DRFTP1");



        Assert.That(result, Is.Not.Null);

        Assert.That(result!.PartyDisplayStatus, Is.EqualTo(PartyDisplayStatus.Draft));

        Assert.That(result.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Draft));

    }



    [Test]

    public async Task GetPublicPartyAsync_ReturnsLive_WhenActiveSessionAndOrganizerConnected()

    {

        var partyRepository = new InMemoryPartyRepository();

        var streamingRepository = new InMemoryStreamingRepository();

        var tracker = new FakeOrganizerTracker();

        tracker.ConnectedPartyIds.Add(PartyId);

        await SeedPartyAsync(partyRepository, PartyLifecycleState.Ready, "PUBLV1");

        await streamingRepository.SetSessionStateAsync(PartyId, ActiveSession());



        var service = CreateService(partyRepository, streamingRepository, tracker);



        var result = await service.GetPublicPartyAsync("PUBLV1");



        Assert.That(result, Is.Not.Null);

        Assert.That(result!.PartyDisplayStatus, Is.EqualTo(PartyDisplayStatus.Live));

        Assert.That(result.HasActiveSession, Is.True);

    }



    [Test]

    public async Task GetPublicPartyAsync_ReturnsPartyEnded_ForCompletedLifecycle()

    {

        var partyRepository = new InMemoryPartyRepository();

        var streamingRepository = new InMemoryStreamingRepository();

        await SeedPartyAsync(partyRepository, PartyLifecycleState.Completed, "PUBEND");

        await streamingRepository.SetSessionStateAsync(PartyId, ActiveSession());



        var service = CreateService(partyRepository, streamingRepository, new FakeOrganizerTracker());



        var result = await service.GetPublicPartyAsync("PUBEND");



        Assert.That(result, Is.Not.Null);

        Assert.That(result!.PartyDisplayStatus, Is.EqualTo(PartyDisplayStatus.PartyEnded));

    }



    [Test]

    public async Task GetPublicPartyAsync_UsesStubbedDisplayStatus_WhenComputeIsMocked()

    {

        var partyRepository = new InMemoryPartyRepository();

        await SeedPartyAsync(partyRepository, PartyLifecycleState.Ready, "PUBMCK");



        var service = new PublicPartyQueryService(

            partyRepository,

            new InMemoryStreamingRepository(),

            new StubPartyDisplayStatusService(PartyDisplayStatus.StartingSoon),

            NullLogger<PublicPartyQueryService>.Instance);



        var result = await service.GetPublicPartyAsync("PUBMCK");



        Assert.That(result, Is.Not.Null);

        Assert.That(result!.PartyDisplayStatus, Is.EqualTo(PartyDisplayStatus.StartingSoon));

    }



    [Test]

    public async Task GetAllPublicPartiesAsync_ExcludesDraftAndMapsLifecycleOnListItems()

    {

        var partyRepository = new InMemoryPartyRepository();

        await SeedPartyAsync(partyRepository, PartyLifecycleState.Draft, "DRAFTL", listedInCatalog: true);

        await partyRepository.AddAsync(new Party

        {

            Id = ListedReadyPartyId,

            OrganizerId = Guid.NewGuid(),

            Name = "Listed Ready",

            ShortCode = "LISTED",

            PartyThemeId = PartyThemeId.Basic,

            Playlist = new PartyPlaylist(),

            CreatedAt = Now,

            PartyLifecycleState = PartyLifecycleState.Ready,

            IsListedInCatalog = true,

        });



        var service = CreateService(partyRepository, new InMemoryStreamingRepository(), new FakeOrganizerTracker());



        var result = await service.GetAllPublicPartiesAsync();



        Assert.That(result, Has.Count.EqualTo(1));

        Assert.That(result[0].ShortCode, Is.EqualTo("LISTED"));

        Assert.That(result[0].PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));

    }



    private static PublicPartyQueryService CreateService(

        InMemoryPartyRepository partyRepository,

        InMemoryStreamingRepository streamingRepository,

        FakeOrganizerTracker tracker)

    {

        return new PublicPartyQueryService(

            partyRepository,

            streamingRepository,

            new PartyDisplayStatusService(

                tracker,

                Options.Create(new PartyDisplayStatusOptions

                {

                    OrganizerOfflineGraceSeconds = 60,

                    PlaybackStaleThresholdSeconds = 30,

                })),

            NullLogger<PublicPartyQueryService>.Instance);

    }



    private static async Task SeedPartyAsync(

        InMemoryPartyRepository repository,

        PartyLifecycleState lifecycleState,

        string shortCode,

        bool listedInCatalog = false)

    {

        await repository.AddAsync(new Party

        {

            Id = PartyId,

            OrganizerId = Guid.NewGuid(),

            Name = $"Public {shortCode}",

            ShortCode = shortCode,

            PartyThemeId = PartyThemeId.Basic,

            Playlist = new PartyPlaylist(),

            CreatedAt = Now,

            PartyLifecycleState = lifecycleState,

            IsListedInCatalog = listedInCatalog,

        });

    }



    private static PlaybackState ActiveSession() => new()

    {

        IsActive = true,

        Mode = PlaybackMode.Session,

        Status = PlaybackStatus.Playing,

        LastUpdatedAt = DateTime.UtcNow,

    };

}


