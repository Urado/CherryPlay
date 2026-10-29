using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Options;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class PartyServiceCatalogVisibilityFutureLimitTests
{
    [TestCase(true, true)]
    [TestCase(false, false)]
    public async Task UpdateWithFutureLimit_PersistsExplicitCatalogVisibility(bool requestedVisibility, bool expectedVisibility)
    {
        var organizerId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        var party = new Party
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizerId,
            Name = "Future party",
            ShortCode = "FUT001",
            EventDateTime = DateTime.UtcNow.AddDays(2),
            PartyLifecycleState = PartyLifecycleState.Ready,
            IsListedInCatalog = !expectedVisibility
        };
        await repository.AddAsync(party);
        var context = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
        context.HttpContext.Items["OrganizerId"] = organizerId;
        var service = new PartyService(
            repository,
            new InMemoryStreamingRepository(),
            new TestShortCodeGenerator(),
            context,
            new TestPlaylistNotifier(),
            new PartyAccessService(repository, NullLogger<PartyAccessService>.Instance),
            new TestThemeAccessService(),
            NullLogger<PartyService>.Instance,
            Options.Create(new PartyLimitOptions { EnforceFuturePartyLimit = true }));

        await service.UpdatePartyMetadataAsync(party.Id, new CherryPlayServer.Models.UpdatePartyDto
        {
            IsListedInCatalog = requestedVisibility
        });

        Assert.That((await repository.GetByIdAsync(party.Id))!.IsListedInCatalog, Is.EqualTo(expectedVisibility));
    }

    private sealed class TestShortCodeGenerator : IShortCodeGenerator
    {
        public Task<string> GenerateUniqueShortCodeAsync(Func<string, Task<bool>> uniquenessChecker, int maxRetries = 10) =>
            Task.FromResult("TEST001");
    }

    private sealed class TestPlaylistNotifier : IPartyPlaylistNotifier
    {
        public Task NotifyPlaylistChangedAsync(Guid partyId) => Task.CompletedTask;
    }

    private sealed class TestThemeAccessService : IThemeAccessService
    {
        public Task<ThemeAccessSummary> GetAccessSummaryAsync(Guid organizerId) =>
            Task.FromResult(new ThemeAccessSummary([], [], string.Empty));

        public Task<ThemeAccessCheckResult> CheckThemeAccessAsync(Guid organizerId, string themeId) =>
            Task.FromResult(new ThemeAccessCheckResult(true, true, []));
    }
}
