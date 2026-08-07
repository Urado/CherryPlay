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

public class PartyLifecycleTransitionTests
{
    [Test]
    public async Task MarkPartyReady_FromDraft_TransitionsToReady()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await SeedParty(repository, partyId, organizerId, PartyLifecycleState.Draft);
        var service = CreateService(organizerId, repository);

        var result = await service.TransitionPartyLifecycleAsync(partyId, PartyLifecycleState.Ready);

        Assert.That(result.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
        var saved = await repository.GetByIdAsync(partyId);
        Assert.That(saved!.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
    }

    [Test]
    public async Task MarkPartyCompleted_FromReady_TransitionsToCompleted()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await SeedParty(repository, partyId, organizerId, PartyLifecycleState.Ready);
        var service = CreateService(organizerId, repository);

        var result = await service.TransitionPartyLifecycleAsync(partyId, PartyLifecycleState.Completed);

        Assert.That(result.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Completed));
    }

    [Test]
    public void RevertPartyToDraft_FromReady_ThrowsInvalidPartyLifecycleTransition()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        Assert.That(async () =>
        {
            await SeedParty(repository, partyId, organizerId, PartyLifecycleState.Ready);
            var service = CreateService(organizerId, repository);
            await service.TransitionPartyLifecycleAsync(partyId, PartyLifecycleState.Draft);
        }, Throws.TypeOf<InvalidPartyLifecycleTransitionException>()
            .With.Property(nameof(InvalidPartyLifecycleTransitionException.CurrentState))
            .EqualTo(PartyLifecycleState.Ready)
            .And.Property(nameof(InvalidPartyLifecycleTransitionException.RequestedState))
            .EqualTo(PartyLifecycleState.Draft));
    }

    [Test]
    public async Task MarkPartyReady_WhenAlreadyReady_IsIdempotent()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await SeedParty(repository, partyId, organizerId, PartyLifecycleState.Ready);
        var service = CreateService(organizerId, repository);

        var result = await service.TransitionPartyLifecycleAsync(partyId, PartyLifecycleState.Ready);

        Assert.That(result.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Ready));
    }

    [Test]
    public async Task MarkPartyCompleted_WhenAlreadyCompleted_IsIdempotent()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await SeedParty(repository, partyId, organizerId, PartyLifecycleState.Completed);
        var service = CreateService(organizerId, repository);

        var result = await service.TransitionPartyLifecycleAsync(partyId, PartyLifecycleState.Completed);

        Assert.That(result.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Completed));
    }

    [Test]
    public async Task TransitionToDraft_WhenAlreadyDraft_IsIdempotent()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await SeedParty(repository, partyId, organizerId, PartyLifecycleState.Draft);
        var service = CreateService(organizerId, repository);

        var result = await service.TransitionPartyLifecycleAsync(partyId, PartyLifecycleState.Draft);

        Assert.That(result.PartyLifecycleState, Is.EqualTo(PartyLifecycleState.Draft));
    }

    [Test]
    public void MarkPartyCompleted_FromDraft_ThrowsInvalidPartyLifecycleTransition()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        Assert.That(async () =>
        {
            await SeedParty(repository, partyId, organizerId, PartyLifecycleState.Draft);
            var service = CreateService(organizerId, repository);
            await service.TransitionPartyLifecycleAsync(partyId, PartyLifecycleState.Completed);
        }, Throws.TypeOf<InvalidPartyLifecycleTransitionException>()
            .With.Property(nameof(InvalidPartyLifecycleTransitionException.CurrentState))
            .EqualTo(PartyLifecycleState.Draft)
            .And.Property(nameof(InvalidPartyLifecycleTransitionException.RequestedState))
            .EqualTo(PartyLifecycleState.Completed));
    }

    [Test]
    public void RevertPartyToDraft_FromCompleted_ThrowsInvalidPartyLifecycleTransition()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        Assert.That(async () =>
        {
            await SeedParty(repository, partyId, organizerId, PartyLifecycleState.Completed);
            var service = CreateService(organizerId, repository);
            await service.TransitionPartyLifecycleAsync(partyId, PartyLifecycleState.Draft);
        }, Throws.TypeOf<InvalidPartyLifecycleTransitionException>()
            .With.Property(nameof(InvalidPartyLifecycleTransitionException.CurrentState))
            .EqualTo(PartyLifecycleState.Completed)
            .And.Property(nameof(InvalidPartyLifecycleTransitionException.RequestedState))
            .EqualTo(PartyLifecycleState.Draft));
    }

    [Test]
    public void MarkPartyReady_FromCompleted_ThrowsInvalidPartyLifecycleTransition()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        Assert.That(async () =>
        {
            await SeedParty(repository, partyId, organizerId, PartyLifecycleState.Completed);
            var service = CreateService(organizerId, repository);
            await service.TransitionPartyLifecycleAsync(partyId, PartyLifecycleState.Ready);
        }, Throws.TypeOf<InvalidPartyLifecycleTransitionException>());
    }

    [Test]
    public void MarkPartyReady_WhenPartyNotFound_ThrowsPartyNotFound()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var service = CreateService(organizerId, new InMemoryPartyRepository());

        Assert.ThrowsAsync<PartyNotFoundException>(
            () => service.TransitionPartyLifecycleAsync(partyId, PartyLifecycleState.Ready));
    }

    [Test]
    public void MarkPartyReady_WhenWrongOrganizer_ThrowsForbidden()
    {
        var ownerId = Guid.NewGuid();
        var otherOrganizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        Assert.That(async () =>
        {
            await SeedParty(repository, partyId, ownerId, PartyLifecycleState.Draft);
            var service = CreateService(otherOrganizerId, repository);
            await service.TransitionPartyLifecycleAsync(partyId, PartyLifecycleState.Ready);
        }, Throws.TypeOf<ForbiddenException>());
    }

    private static async Task SeedParty(
        InMemoryPartyRepository repository,
        Guid partyId,
        Guid organizerId,
        PartyLifecycleState lifecycleState)
    {
        await repository.AddAsync(new Party
        {
            Id = partyId,
            OrganizerId = organizerId,
            Name = "Lifecycle Test Party",
            ShortCode = "LIFE01",
            PartyThemeId = PartyThemeId.Basic,
            Playlist = new PartyPlaylist(),
            CreatedAt = DateTime.UtcNow,
            PartyLifecycleState = lifecycleState,
        });
    }

    private static PartyService CreateService(Guid organizerId, IPartyRepository partyRepository)
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
            Task.FromResult("AUTO01");
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
