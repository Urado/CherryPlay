using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

public class PartyServiceThemeAccessBehaviorTests
{
    [Fact]
    public async Task CreateParty_WithBasicTheme_SucceedsForNewOrganizer()
    {
        var themeAccess = new FakeThemeAccessService();
        themeAccess.SetResult("basic", new ThemeAccessCheckResult(true, true, []));
        var service = CreateService(themeAccessService: themeAccess);

        var result = await service.CreatePartyAsync(new CreatePartyDto
        {
            Name = "Fresh Organizer Party",
            PartyThemeId = PartyThemeId.Basic,
        });

        Assert.Equal(PartyThemeId.Basic, result.PartyThemeId);
    }

    [Fact]
    public async Task CreateParty_WithPaidThemeWithoutEntitlement_ThrowsThemeNotEntitled()
    {
        var themeAccess = new FakeThemeAccessService();
        themeAccess.SetResult("cyberpunk", new ThemeAccessCheckResult(false, true, ["extended"]));
        var service = CreateService(themeAccessService: themeAccess);

        var exception = await Assert.ThrowsAsync<ThemeNotEntitledException>(() => service.CreatePartyAsync(new CreatePartyDto
        {
            Name = "Paid Theme Attempt",
            PartyThemeId = PartyThemeId.Cyberpunk,
        }));

        Assert.Equal("cyberpunk", exception.ThemeId);
        Assert.Contains("extended", exception.RequiredPackageCodes);
    }

    [Fact]
    public async Task UpdatePartyMetadata_WithoutPartyThemeId_DoesNotCheckEntitlement()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var partyRepository = new InMemoryPartyRepository();
        await partyRepository.AddAsync(new Party
        {
            Id = partyId,
            OrganizerId = organizerId,
            Name = "Original Name",
            ShortCode = "NOCHK1",
            PartyThemeId = PartyThemeId.Cyberpunk,
            Playlist = new PartyPlaylist(),
            CreatedAt = DateTime.UtcNow,
        });

        var themeAccess = new FakeThemeAccessService();
        var service = CreateService(organizerId, partyRepository, themeAccess);

        await service.UpdatePartyMetadataAsync(partyId, new UpdatePartyDto { Name = "Renamed" });

        Assert.Equal(0, themeAccess.CheckCallCount);
    }

    [Fact]
    public async Task UpdatePartyMetadata_WithUnchangedPartyThemeId_DoesNotCheckEntitlement()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var partyRepository = new InMemoryPartyRepository();
        await partyRepository.AddAsync(new Party
        {
            Id = partyId,
            OrganizerId = organizerId,
            Name = "Original Name",
            ShortCode = "NOCHK2",
            PartyThemeId = PartyThemeId.Basic,
            Playlist = new PartyPlaylist(),
            CreatedAt = DateTime.UtcNow,
        });

        var themeAccess = new FakeThemeAccessService();
        var service = CreateService(organizerId, partyRepository, themeAccess);

        await service.UpdatePartyMetadataAsync(partyId, new UpdatePartyDto { PartyThemeId = PartyThemeId.Basic });

        Assert.Equal(0, themeAccess.CheckCallCount);
    }

    [Fact]
    public async Task UpdatePartyMetadata_WhenThemeChangesToInaccessible_ThrowsThemeNotEntitled()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var partyRepository = new InMemoryPartyRepository();
        await partyRepository.AddAsync(new Party
        {
            Id = partyId,
            OrganizerId = organizerId,
            Name = "Original Name",
            ShortCode = "CHG001",
            PartyThemeId = PartyThemeId.Basic,
            Playlist = new PartyPlaylist(),
            CreatedAt = DateTime.UtcNow,
        });

        var themeAccess = new FakeThemeAccessService();
        themeAccess.SetResult("sakura", new ThemeAccessCheckResult(false, true, ["extended"]));
        var service = CreateService(organizerId, partyRepository, themeAccess);

        var exception = await Assert.ThrowsAsync<ThemeNotEntitledException>(() =>
            service.UpdatePartyMetadataAsync(partyId, new UpdatePartyDto { PartyThemeId = PartyThemeId.Sakura }));

        Assert.Equal("sakura", exception.ThemeId);
        Assert.Contains("extended", exception.RequiredPackageCodes);
    }

    [Fact]
    public async Task UpdatePartyMetadata_WhenThemeIsNotVisibleAndNotAllowed_ThrowsThemeNotEntitled()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var partyRepository = new InMemoryPartyRepository();
        await partyRepository.AddAsync(new Party
        {
            Id = partyId,
            OrganizerId = organizerId,
            Name = "Original Name",
            ShortCode = "VIS001",
            PartyThemeId = PartyThemeId.Basic,
            Playlist = new PartyPlaylist(),
            CreatedAt = DateTime.UtcNow,
        });

        var themeAccess = new FakeThemeAccessService();
        themeAccess.SetResult("cyberpunk", new ThemeAccessCheckResult(false, false, []));
        var service = CreateService(organizerId, partyRepository, themeAccess);

        var exception = await Assert.ThrowsAsync<ThemeNotEntitledException>(() =>
            service.UpdatePartyMetadataAsync(partyId, new UpdatePartyDto { PartyThemeId = PartyThemeId.Cyberpunk }));

        Assert.Equal("cyberpunk", exception.ThemeId);
        Assert.Empty(exception.RequiredPackageCodes);
    }

    private static PartyService CreateService(
        Guid? organizerId = null,
        IPartyRepository? partyRepository = null,
        IThemeAccessService? themeAccessService = null)
    {
        var contextAccessor = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext(),
        };
        contextAccessor.HttpContext.Items["OrganizerId"] = organizerId ?? Guid.NewGuid();

        return new PartyService(
            partyRepository ?? new InMemoryPartyRepository(),
            new InMemoryStreamingRepository(),
            new FixedShortCodeGenerator(),
            contextAccessor,
            new NoOpPlaylistNotifier(),
            new NoOpPartyAccessService(),
            themeAccessService ?? new FakeThemeAccessService(),
            NullLogger<PartyService>.Instance);
    }

    private sealed class FakeThemeAccessService : IThemeAccessService
    {
        private readonly Dictionary<string, ThemeAccessCheckResult> _results = new(StringComparer.Ordinal);

        public int CheckCallCount { get; private set; }

        public void SetResult(string themeId, ThemeAccessCheckResult result)
        {
            _results[themeId] = result;
        }

        public Task<ThemeAccessSummary> GetAccessSummaryAsync(Guid organizerId) =>
            Task.FromResult(new ThemeAccessSummary([], [], "https://vk.com/<owner>"));

        public Task<ThemeAccessCheckResult> CheckThemeAccessAsync(Guid organizerId, string themeId)
        {
            CheckCallCount++;
            return Task.FromResult(_results.TryGetValue(themeId, out var result)
                ? result
                : new ThemeAccessCheckResult(true, true, []));
        }
    }

    private sealed class NoOpPartyAccessService : IPartyAccessService
    {
        public Task EnsurePartyOwnershipAsync(Guid partyId, Guid organizerId) => Task.CompletedTask;
    }

    private sealed class NoOpPlaylistNotifier : IPartyPlaylistNotifier
    {
        public Task NotifyPlaylistChangedAsync(Guid partyId) => Task.CompletedTask;
    }

    private sealed class FixedShortCodeGenerator : IShortCodeGenerator
    {
        public Task<string> GenerateUniqueShortCodeAsync(Func<string, Task<bool>> uniquenessChecker, int maxRetries = 10) =>
            Task.FromResult("AUTO01");
    }
}
