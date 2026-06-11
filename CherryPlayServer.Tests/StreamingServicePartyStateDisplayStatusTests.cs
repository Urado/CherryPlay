using CherryPlayServer.Core.Entities;

using CherryPlayServer.Core.Enums;

using CherryPlayServer.Core.Interfaces;

using CherryPlayServer.Core.Options;

using CherryPlayServer.Core.Services;

using CherryPlayServer.Infrastructure.Repositories;

using Microsoft.Extensions.Logging.Abstractions;

using Microsoft.Extensions.Options;



namespace CherryPlayServer.Tests;



[TestFixture]

public class StreamingServicePartyStateDisplayStatusTests

{

    private static readonly Guid PartyId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    private static readonly DateTime Now = new(2026, 5, 29, 12, 0, 0, DateTimeKind.Utc);



    [Test]

    public async Task GetPartyStateAsync_ReturnsPartyDisplayStatus_FromCompute_ForReadyScheduledFixture()

    {

        var partyRepository = new InMemoryPartyRepository();

        var streamingRepository = new InMemoryStreamingRepository();

        var tracker = new FakeOrganizerTracker();

        await SeedPartyAsync(partyRepository, PartyLifecycleState.Ready, "STATE1");



        var service = CreateService(partyRepository, streamingRepository, tracker);



        var result = await service.GetPartyStateAsync("STATE1");



        Assert.That(result, Is.Not.Null);

        Assert.That(result!.PartyDisplayStatus, Is.EqualTo(PartyDisplayStatus.Scheduled));

    }



    [Test]

    public async Task GetPartyStateAsync_ReturnsLive_WhenActiveSessionAndOrganizerConnected()

    {

        var partyRepository = new InMemoryPartyRepository();

        var streamingRepository = new InMemoryStreamingRepository();

        var tracker = new FakeOrganizerTracker();

        tracker.ConnectedPartyIds.Add(PartyId);

        await SeedPartyAsync(partyRepository, PartyLifecycleState.Ready, "LIVE01");

        await streamingRepository.SetSessionStateAsync(PartyId, ActiveSession());



        var service = CreateService(partyRepository, streamingRepository, tracker);



        var result = await service.GetPartyStateAsync("LIVE01");



        Assert.That(result, Is.Not.Null);

        Assert.That(result!.PartyDisplayStatus, Is.EqualTo(PartyDisplayStatus.Live));

        Assert.That(result.IsSessionActive, Is.True);

    }



    [Test]

    public async Task GetPartyStateAsync_ReturnsDraft_ForDraftLifecycle()

    {

        var partyRepository = new InMemoryPartyRepository();

        var streamingRepository = new InMemoryStreamingRepository();

        await SeedPartyAsync(partyRepository, PartyLifecycleState.Draft, "DRFT01");



        var service = CreateService(partyRepository, streamingRepository, new FakeOrganizerTracker());



        var result = await service.GetPartyStateAsync("DRFT01");



        Assert.That(result, Is.Not.Null);

        Assert.That(result!.PartyDisplayStatus, Is.EqualTo(PartyDisplayStatus.Draft));

    }



    [Test]

    public async Task GetPartyStateAsync_ReturnsStubbedDisplayStatus_WhenComputeIsMocked()

    {

        var partyRepository = new InMemoryPartyRepository();

        await SeedPartyAsync(partyRepository, PartyLifecycleState.Ready, "MOCK01");



        var service = new StreamingService(

            partyRepository,

            new InMemoryStreamingRepository(),

            new StubPlaylistTrackFinder(),

            new StubPartyDisplayStatusService(PartyDisplayStatus.StartingSoon),

            NullLogger<StreamingService>.Instance);



        var result = await service.GetPartyStateAsync("MOCK01");



        Assert.That(result, Is.Not.Null);

        Assert.That(result!.PartyDisplayStatus, Is.EqualTo(PartyDisplayStatus.StartingSoon));

    }



    [Test]

    public async Task GetPartyStateAsync_ReturnsNull_WhenPartyNotFound()

    {

        var service = CreateService(

            new InMemoryPartyRepository(),

            new InMemoryStreamingRepository(),

            new FakeOrganizerTracker());



        var result = await service.GetPartyStateAsync("MISSING");



        Assert.That(result, Is.Null);

    }



    private static StreamingService CreateService(

        InMemoryPartyRepository partyRepository,

        InMemoryStreamingRepository streamingRepository,

        FakeOrganizerTracker tracker)

    {

        return new StreamingService(

            partyRepository,

            streamingRepository,

            new StubPlaylistTrackFinder(),

            new PartyDisplayStatusService(

                tracker,

                Options.Create(new PartyDisplayStatusOptions

                {

                    OrganizerOfflineGraceSeconds = 60,

                    PlaybackStaleThresholdSeconds = 30,

                })),

            NullLogger<StreamingService>.Instance);

    }



    private static async Task SeedPartyAsync(

        InMemoryPartyRepository repository,

        PartyLifecycleState lifecycleState,

        string shortCode)

    {

        await repository.AddAsync(new Party

        {

            Id = PartyId,

            OrganizerId = Guid.NewGuid(),

            Name = $"Party {shortCode}",

            ShortCode = shortCode,

            PartyThemeId = PartyThemeId.Basic,

            Playlist = new PartyPlaylist(),

            CreatedAt = Now,

            PartyLifecycleState = lifecycleState,

        });

    }



    private static PlaybackState ActiveSession() => new()

    {

        IsActive = true,

        Mode = PlaybackMode.Session,

        Status = PlaybackStatus.Playing,

        LastUpdatedAt = DateTime.UtcNow,

    };



    private sealed class StubPlaylistTrackFinder : IPlaylistTrackFinder

    {

        public double? FindTrackDuration(List<PlayerItem> items, string trackId) => null;

    }

}


