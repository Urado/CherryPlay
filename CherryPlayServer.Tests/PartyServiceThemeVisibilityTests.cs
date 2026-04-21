using CherryPlayServer.Core.Authorization;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

public class PartyServiceThemeVisibilityTests
{
    [Fact]
    public async Task CreateParty_ThrowsThemeNotEntitled_WhenThemeIsInvisibleAndNotAllowed()
    {
        var service = CreateService(
            themeAccessService: new StubThemeAccessService(new ThemeAccessCheckResult(false, false, [])));

        var createDto = new CreatePartyDto
        {
            Name = "Spring Party",
            PartyThemeId = PartyThemeId.Cyberpunk
        };

        await Assert.ThrowsAsync<ThemeNotEntitledException>(() => service.CreatePartyAsync(createDto));
    }

    [Fact]
    public async Task UpdateParty_ThrowsThemeNotEntitled_WhenChangingToInvisibleTheme()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var repository = new StubPartyRepository(
            new Party
            {
                Id = partyId,
                OrganizerId = organizerId,
                Name = "Current",
                ShortCode = "ABC123",
                PartyThemeId = PartyThemeId.Basic,
                Playlist = new PartyPlaylist(),
                CreatedAt = DateTime.UtcNow
            });

        var service = CreateService(
            organizerId: organizerId,
            partyRepository: repository,
            partyAccessService: new StubPartyAccessService(),
            themeAccessService: new StubThemeAccessService(new ThemeAccessCheckResult(false, false, [])));

        var updateDto = new UpdatePartyDto { PartyThemeId = PartyThemeId.Cyberpunk };

        await Assert.ThrowsAsync<ThemeNotEntitledException>(() => service.UpdatePartyMetadataAsync(partyId, updateDto));
    }

    [Fact]
    public async Task UpdateParty_DoesNotCheckThemeAccess_WhenThemeIsUnchanged()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var repository = new StubPartyRepository(
            new Party
            {
                Id = partyId,
                OrganizerId = organizerId,
                Name = "Current",
                ShortCode = "ABC123",
                PartyThemeId = PartyThemeId.Basic,
                Playlist = new PartyPlaylist(),
                CreatedAt = DateTime.UtcNow
            });
        var themeAccess = new CountingThemeAccessService(new ThemeAccessCheckResult(false, false, []));
        var service = CreateService(
            organizerId: organizerId,
            partyRepository: repository,
            partyAccessService: new StubPartyAccessService(),
            themeAccessService: themeAccess);

        var updateDto = new UpdatePartyDto { PartyThemeId = PartyThemeId.Basic };
        await service.UpdatePartyMetadataAsync(partyId, updateDto);

        Assert.Equal(0, themeAccess.CheckCount);
    }

    private static PartyService CreateService(
        Guid? organizerId = null,
        IPartyRepository? partyRepository = null,
        IPartyAccessService? partyAccessService = null,
        IThemeAccessService? themeAccessService = null)
    {
        var contextAccessor = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext()
        };
        contextAccessor.HttpContext.Items["OrganizerId"] = organizerId ?? Guid.NewGuid();

        return new PartyService(
            partyRepository ?? new StubPartyRepository(),
            new StubStreamingRepository(),
            new StubShortCodeGenerator(),
            contextAccessor,
            new StubPlaylistNotifier(),
            partyAccessService ?? new StubPartyAccessService(),
            themeAccessService ?? new StubThemeAccessService(new ThemeAccessCheckResult(true, true, [])),
            NullLogger<PartyService>.Instance);
    }

    private class StubThemeAccessService(ThemeAccessCheckResult result) : IThemeAccessService
    {
        public Task<ThemeAccessSummary> GetAccessSummaryAsync(Guid organizerId) =>
            Task.FromResult(new ThemeAccessSummary([], [], "https://vk.com/<owner>"));

        public virtual Task<ThemeAccessCheckResult> CheckThemeAccessAsync(Guid organizerId, string themeId) =>
            Task.FromResult(result);
    }

    private sealed class CountingThemeAccessService(ThemeAccessCheckResult result) : StubThemeAccessService(result)
    {
        public int CheckCount { get; private set; }

        public override Task<ThemeAccessCheckResult> CheckThemeAccessAsync(Guid organizerId, string themeId)
        {
            CheckCount++;
            return base.CheckThemeAccessAsync(organizerId, themeId);
        }
    }

    private sealed class StubPartyRepository(params Party[] parties) : IPartyRepository
    {
        private readonly Dictionary<Guid, Party> _parties = parties.ToDictionary(x => x.Id, x => x);

        public Task<Party?> GetByIdAsync(Guid id) => Task.FromResult(_parties.TryGetValue(id, out var party) ? party : null);
        public Task<Party?> GetByShortCodeAsync(string shortCode) => Task.FromResult(_parties.Values.FirstOrDefault(x => x.ShortCode == shortCode));
        public Task<List<Party>> GetAllAsync() => Task.FromResult(_parties.Values.ToList());
        public Task<List<Party>> GetByOrganizerIdAsync(Guid organizerId) => Task.FromResult(_parties.Values.Where(x => x.OrganizerId == organizerId).ToList());

        public Task<Party> AddAsync(Party party)
        {
            _parties[party.Id] = party;
            return Task.FromResult(party);
        }

        public Task UpdateAsync(Party party)
        {
            _parties[party.Id] = party;
            return Task.CompletedTask;
        }

        public Task DeleteAsync(Guid id)
        {
            _parties.Remove(id);
            return Task.CompletedTask;
        }

        public Task<Party?> GetFirstAsync() => Task.FromResult(_parties.Values.FirstOrDefault());
    }

    private sealed class StubStreamingRepository : IStreamingRepository
    {
        public Task<PlaybackState?> GetSessionStateAsync(Guid partyId) => Task.FromResult<PlaybackState?>(null);
        public Task SetSessionStateAsync(Guid partyId, PlaybackState state) => Task.CompletedTask;
        public Task DeleteSessionStateAsync(Guid partyId) => Task.CompletedTask;
        public Task<Dictionary<Guid, PlaybackState>> GetAllSessionStatesAsync() => Task.FromResult(new Dictionary<Guid, PlaybackState>());
    }

    private sealed class StubShortCodeGenerator : IShortCodeGenerator
    {
        public Task<string> GenerateUniqueShortCodeAsync(Func<string, Task<bool>> uniquenessChecker, int maxRetries = 10) =>
            Task.FromResult("ABC123");
    }

    private sealed class StubPlaylistNotifier : IPartyPlaylistNotifier
    {
        public Task NotifyPlaylistChangedAsync(Guid partyId) => Task.CompletedTask;
    }

    private sealed class StubPartyAccessService : IPartyAccessService
    {
        public Task EnsurePartyOwnershipAsync(Guid partyId, Guid organizerId) => Task.CompletedTask;
    }
}
