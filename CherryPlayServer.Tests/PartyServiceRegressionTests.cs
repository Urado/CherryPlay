using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class PartyServiceRegressionTests
{
    [Test]
    public async Task UpdatePartyMetadata_WhenChangingOneField_PreservesOtherPartyData()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var parties = new InMemoryPartyRepository();
        var states = new InMemoryStreamingRepository();
        await parties.AddAsync(new Party
        {
            Id = partyId,
            OrganizerId = organizerId,
            Name = "Original",
            Title = "Original title",
            ShortCode = "PARTY1",
            PartyThemeId = PartyThemeDefaults.Id,
            Playlist = new PartyPlaylist { TotalTracks = 1, Items = [new CherryPlayServer.Core.Entities.PlayerItem { Id = "track-a", Type = PlayerItemType.Track }] },
            CreatedAt = DateTime.UtcNow,
            PartyLifecycleState = PartyLifecycleState.Ready
        });
        var originalState = new PlaybackState { IsActive = true, CurrentTrackId = "track-a", Position = 23 };
        await states.SetSessionStateAsync(partyId, originalState);
        var service = CreateService(organizerId, parties, states);

        await service.UpdatePartyMetadataAsync(partyId, new UpdatePartyDto { Name = "Renamed" });

        var updated = await parties.GetByIdAsync(partyId);
        var state = await states.GetSessionStateAsync(partyId);
        Assert.That(updated!.Name, Is.EqualTo("Renamed"));
        Assert.That(updated.Title, Is.EqualTo("Original title"));
        Assert.That(updated.Playlist.TotalTracks, Is.EqualTo(1));
        Assert.That(updated.Playlist.Items.Single().Id, Is.EqualTo("track-a"));
        Assert.That(state!.CurrentTrackId, Is.EqualTo("track-a"));
        Assert.That(state.Position, Is.EqualTo(23));
    }

    [Test]
    public async Task UpdatePartyPlaylist_WhenNestedTrackCountIsAtMaximum_SavesAllTracks()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var parties = new InMemoryPartyRepository();
        await parties.AddAsync(new Party
        {
            Id = partyId,
            OrganizerId = organizerId,
            Name = "Playlist boundary",
            ShortCode = "BOUND1",
            Playlist = new PartyPlaylist { TotalTracks = 1 },
            CreatedAt = DateTime.UtcNow
        });
        var service = CreateService(organizerId, parties, new InMemoryStreamingRepository());
        var playlist = CreateNestedPlaylist(AuthConstants.MaxPlaylistTracks);

        await service.UpdatePartyPlaylistAsync(partyId, playlist);

        var saved = (await parties.GetByIdAsync(partyId))!.Playlist;
        Assert.That(saved.TotalTracks, Is.EqualTo(AuthConstants.MaxPlaylistTracks));
        Assert.That(saved.Items.Single().Items!.Single().Items, Has.Count.EqualTo(AuthConstants.MaxPlaylistTracks));
        Assert.That(saved.Items.Single().Items!.Single().Items!.Count(item => item.Type == PlayerItemType.Track), Is.EqualTo(AuthConstants.MaxPlaylistTracks));
    }

    [Test]
    public async Task UpdatePartyPlaylist_AboveMaximumTrackCount_LeavesExistingPlaylist()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var parties = new InMemoryPartyRepository();
        await parties.AddAsync(new Party
        {
            Id = partyId,
            OrganizerId = organizerId,
            Name = "Playlist boundary",
            ShortCode = "BOUND2",
            Playlist = new PartyPlaylist { TotalTracks = 1, Items = [new CherryPlayServer.Core.Entities.PlayerItem { Id = "existing", Type = PlayerItemType.Track }] },
            CreatedAt = DateTime.UtcNow
        });
        var service = CreateService(organizerId, parties, new InMemoryStreamingRepository());

        Assert.ThrowsAsync<ArgumentException>(() => service.UpdatePartyPlaylistAsync(
            partyId,
            CreateNestedPlaylist(AuthConstants.MaxPlaylistTracks + 1)));

        var saved = await parties.GetByIdAsync(partyId);
        Assert.That(saved!.Playlist.TotalTracks, Is.EqualTo(1));
        Assert.That(saved.Playlist.Items.Single().Id, Is.EqualTo("existing"));
    }

    private static PartyPlaylistDto CreateNestedPlaylist(int trackCount) => new(
        [new CherryPlayServer.Models.PlayerItem(
            "group-a",
            "group",
            "Outer group",
            0,
            0,
            Items: [new CherryPlayServer.Models.PlayerItem(
                "group-b",
                "group",
                "Inner group",
                0,
                1,
                Items: Enumerable.Range(0, trackCount)
                    .Select(index => new CherryPlayServer.Models.PlayerItem(
                        $"track-{index}",
                        "track",
                        $"Track {index}",
                        index,
                        2,
                        Duration: 120))
                    .ToList())])],
        TotalTracks: trackCount);

    private static PartyService CreateService(Guid organizerId, InMemoryPartyRepository parties, InMemoryStreamingRepository states)
    {
        var contextAccessor = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
        contextAccessor.HttpContext!.Items["OrganizerId"] = organizerId;
        return new PartyService(
            parties,
            states,
            new RegressionShortCodeGenerator(),
            contextAccessor,
            new RegressionPlaylistNotifier(),
            new PartyAccessService(parties, NullLogger<PartyAccessService>.Instance),
            new RegressionThemeAccessService(),
            NullLogger<PartyService>.Instance);
    }
}
