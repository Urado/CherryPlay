using System.Text.Json;
using System.Text.Json.Serialization;
using CherryPlayServer.Controllers;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

public class PartiesControllerLifecycleTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
    };

    [Test]
    public async Task MarkPartyCompleted_FromDraft_Returns409WithSnakeCaseStates()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await repository.AddAsync(new Party
        {
            Id = partyId,
            OrganizerId = organizerId,
            Name = "Draft Party",
            ShortCode = "DRFT01",
            PartyThemeId = PartyThemeId.Basic,
            Playlist = new PartyPlaylist(),
            CreatedAt = DateTime.UtcNow,
            PartyLifecycleState = PartyLifecycleState.Draft,
        });

        var controller = CreateController(organizerId, repository);
        var action = await controller.TransitionPartyLifecycle(
            partyId.ToString(),
            new TransitionPartyLifecycleDto(PartyLifecycleState.Completed));

        Assert.That(action.Result, Is.TypeOf<ConflictObjectResult>());
        var conflict = (ConflictObjectResult)action.Result!;
        Assert.That(conflict.StatusCode, Is.EqualTo(409));
        Assert.That(ReadAnonymousProperty<string>(conflict.Value, "code"), Is.EqualTo("invalid_lifecycle_transition"));

        var json = JsonSerializer.Serialize(conflict.Value, JsonOptions);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        Assert.That(root.GetProperty("currentState").GetString(), Is.EqualTo("draft"));
        Assert.That(root.GetProperty("requestedState").GetString(), Is.EqualTo("completed"));
    }

    private static PartiesController CreateController(Guid organizerId, IPartyRepository partyRepository)
    {
        var contextAccessor = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext(),
        };
        contextAccessor.HttpContext.Items["OrganizerId"] = organizerId;

        var partyService = new PartyService(
            partyRepository,
            new InMemoryStreamingRepository(),
            new FixedShortCodeGenerator(),
            contextAccessor,
            new NoOpPlaylistNotifier(),
            new PartyAccessService(partyRepository, NullLogger<PartyAccessService>.Instance),
            new PermissiveThemeAccessService(),
            NullLogger<PartyService>.Instance);

        var controller = new PartiesController(partyService, NullLogger<PartiesController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = contextAccessor.HttpContext,
        };
        return controller;
    }

    private static T ReadAnonymousProperty<T>(object? value, string propertyName)
    {
        if (value is null)
        {
            throw new AssertionException("Expected non-null anonymous object.");
        }

        var property = value.GetType().GetProperty(propertyName);
        if (property is null)
        {
            throw new AssertionException($"Expected anonymous object to contain property '{propertyName}'.");
        }

        return (T)property.GetValue(value)!;
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
