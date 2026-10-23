using System.Text.Json;
using CherryPlayServer.Controllers;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Options;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Tests;

public sealed class FuturePartyLimitTests
{
    [Test]
    public async Task CreateParty_UndatedAtLimit_ThrowsAndDoesNotPersist()
    {
        var organizerId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await repository.AddAsync(Party(organizerId, null, "UND001"));
        await repository.AddAsync(Party(organizerId, null, "UND002"));
        var service = CreateService(organizerId, repository, enforceFuturePartyLimit: true);

        Assert.ThrowsAsync<PartyLimitReachedException>(() =>
            service.CreatePartyAsync(new CreatePartyDto { Name = "Third undated" }));

        Assert.That(await repository.GetByOrganizerIdAsync(organizerId), Has.Count.EqualTo(2));
    }

    [Test]
    public async Task CreateParty_FutureDatedWhenUndatedPartiesFillLimit_Throws()
    {
        var organizerId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await repository.AddAsync(Party(organizerId, null, "UND001"));
        await repository.AddAsync(Party(organizerId, null, "UND002"));
        var service = CreateService(organizerId, repository, enforceFuturePartyLimit: true);

        Assert.ThrowsAsync<PartyLimitReachedException>(() =>
            service.CreatePartyAsync(new CreatePartyDto
            {
                Name = "Dated",
                EventDateTime = DateTime.UtcNow.AddDays(1),
            }));
    }

    [Test]
    public async Task UpdateParty_FromPastToFutureAtLimit_ThrowsAndKeepsPastDate()
    {
        var organizerId = Guid.NewGuid();
        var pastDate = DateTime.UtcNow.AddDays(-2);
        var repository = new InMemoryPartyRepository();
        var past = Party(organizerId, pastDate, "PAST01");
        await repository.AddAsync(past);
        await repository.AddAsync(Party(organizerId, DateTime.UtcNow.AddDays(1), "FUT001"));
        await repository.AddAsync(Party(organizerId, null, "UND001"));
        var service = CreateService(organizerId, repository, enforceFuturePartyLimit: true);

        Assert.ThrowsAsync<PartyLimitReachedException>(() =>
            service.UpdatePartyMetadataAsync(past.Id, new UpdatePartyDto
            {
                EventDateTime = DateTime.UtcNow.AddDays(4),
            }));

        var saved = await repository.GetByIdAsync(past.Id);
        Assert.That(saved!.EventDateTime, Is.EqualTo(pastDate));
    }

    [Test]
    public async Task UpdateParty_AlreadyFutureDate_DoesNotCountTwice()
    {
        var organizerId = Guid.NewGuid();
        var nextDate = DateTime.UtcNow.AddDays(6);
        var repository = new InMemoryPartyRepository();
        var future = Party(organizerId, DateTime.UtcNow.AddDays(1), "FUT001");
        await repository.AddAsync(future);
        await repository.AddAsync(Party(organizerId, DateTime.UtcNow.AddDays(2), "FUT002"));
        var service = CreateService(organizerId, repository, enforceFuturePartyLimit: true);

        await service.UpdatePartyMetadataAsync(future.Id, new UpdatePartyDto { EventDateTime = nextDate });

        var saved = await repository.GetByIdAsync(future.Id);
        Assert.That(saved!.EventDateTime, Is.EqualTo(nextDate));
    }

    [Test]
    public async Task UpdateParty_UndatedToFutureAtLimit_DoesNotCountTwice()
    {
        var organizerId = Guid.NewGuid();
        var nextDate = DateTime.UtcNow.AddDays(3);
        var repository = new InMemoryPartyRepository();
        var undated = Party(organizerId, null, "UND001");
        await repository.AddAsync(undated);
        await repository.AddAsync(Party(organizerId, null, "UND002"));
        var service = CreateService(organizerId, repository, enforceFuturePartyLimit: true);

        await service.UpdatePartyMetadataAsync(undated.Id, new UpdatePartyDto { EventDateTime = nextDate });

        var saved = await repository.GetByIdAsync(undated.Id);
        Assert.That(saved!.EventDateTime, Is.EqualTo(nextDate));
        Assert.That(saved.Name, Is.EqualTo("UND001"));
    }

    [Test]
    public async Task CreateParty_ConcurrentUndated_StopsAtLimit()
    {
        var organizerId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        var generator = new SequenceShortCodeGenerator();
        var successes = 0;
        var limited = 0;

        await Task.WhenAll(Enumerable.Range(0, 4).Select(async index =>
        {
            var service = CreateService(organizerId, repository, generator, enforceFuturePartyLimit: true);
            try
            {
                await service.CreatePartyAsync(new CreatePartyDto { Name = $"Concurrent {index}" });
                Interlocked.Increment(ref successes);
            }
            catch (PartyLimitReachedException)
            {
                Interlocked.Increment(ref limited);
            }
        }));

        Assert.That(successes, Is.EqualTo(AuthConstants.MaxFuturePartiesPerOrganizer));
        Assert.That(limited, Is.EqualTo(2));
        Assert.That(await repository.GetByOrganizerIdAsync(organizerId), Has.Count.EqualTo(2));
    }

    [Test]
    public async Task UpdateIfFuturePartyLimit_StaleFutureSnapshot_RefusesWhenStoredDateIsPast()
    {
        var organizerId = Guid.NewGuid();
        var pastDate = DateTime.UtcNow.AddDays(-4);
        var repository = new InMemoryPartyRepository();
        var past = Party(organizerId, pastDate, "PAST01");
        await repository.AddAsync(past);
        await repository.AddAsync(Party(organizerId, DateTime.UtcNow.AddDays(1), "FUT001"));
        await repository.AddAsync(Party(organizerId, null, "UND001"));
        var incoming = Party(organizerId, DateTime.UtcNow.AddDays(8), "PAST01");
        incoming.Id = past.Id;
        incoming.Name = "Should not save";

        var allowed = await repository.UpdateIfFuturePartyLimitNotReachedAsync(
            incoming,
            DateTime.UtcNow.AddDays(2),
            DateTime.UtcNow,
            AuthConstants.MaxFuturePartiesPerOrganizer);

        Assert.That(allowed, Is.False);
        var saved = await repository.GetByIdAsync(past.Id);
        Assert.That(saved!.EventDateTime, Is.EqualTo(pastDate));
        Assert.That(saved.Name, Is.EqualTo("PAST01"));
    }

    [Test]
    public async Task CreateParty_UndatedAtLimit_ReturnsStableForbiddenCode()
    {
        var organizerId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await repository.AddAsync(Party(organizerId, null, "UND001"));
        await repository.AddAsync(Party(organizerId, null, "UND002"));
        var controller = CreateController(organizerId, repository, enforceFuturePartyLimit: true);

        var action = await controller.CreateParty(new CreatePartyDto { Name = "Third" });

        AssertLimitBody(action.Result);
    }

    [Test]
    public async Task UpdateParty_PastToFutureAtLimit_ReturnsStableForbiddenCode()
    {
        var organizerId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        var past = Party(organizerId, DateTime.UtcNow.AddDays(-1), "PAST01");
        await repository.AddAsync(past);
        await repository.AddAsync(Party(organizerId, DateTime.UtcNow.AddDays(1), "FUT001"));
        await repository.AddAsync(Party(organizerId, DateTime.UtcNow.AddDays(2), "FUT002"));
        var controller = CreateController(organizerId, repository, enforceFuturePartyLimit: true);

        var action = await controller.UpdatePartyMetadata(
            past.Id.ToString(),
            new UpdatePartyDto { EventDateTime = DateTime.UtcNow.AddDays(5) });

        AssertLimitBody(action);
    }

    [Test]
    public async Task CreateParty_FlagOff_AllowsThirdFutureAndUndated()
    {
        var organizerId = Guid.NewGuid();
        var repository = new InMemoryPartyRepository();
        await repository.AddAsync(Party(organizerId, DateTime.UtcNow.AddDays(1), "FUT001"));
        await repository.AddAsync(Party(organizerId, DateTime.UtcNow.AddDays(2), "FUT002"));
        var service = CreateService(
            organizerId,
            repository,
            partyLimitOptions: Options.Create(new PartyLimitOptions { EnforceFuturePartyLimit = false }));

        await service.CreatePartyAsync(new CreatePartyDto
        {
            Name = "Third future",
            EventDateTime = DateTime.UtcNow.AddDays(3),
        });
        await service.CreatePartyAsync(new CreatePartyDto { Name = "Undated" });

        var saved = await repository.GetByOrganizerIdAsync(organizerId);
        Assert.That(saved, Has.Count.EqualTo(4));
        Assert.That(saved.Count(party => party.EventDateTime == null), Is.EqualTo(1));
        Assert.That(saved.Count(party => party.EventDateTime > DateTime.UtcNow), Is.EqualTo(3));
    }

    private static void AssertLimitBody(IActionResult? action)
    {
        Assert.That(action, Is.TypeOf<ObjectResult>());
        var result = (ObjectResult)action!;
        Assert.That(result.StatusCode, Is.EqualTo(StatusCodes.Status403Forbidden));
        Assert.That(ReadProperty<string>(result.Value, "code"), Is.EqualTo(PartyLimitReachedException.ErrorCode));
        Assert.That(
            ReadProperty<string>(result.Value, "message"),
            Is.EqualTo($"Limit of {AuthConstants.MaxFuturePartiesPerOrganizer} future parties per organizer reached."));
        Assert.That(ReadProperty<int>(result.Value, "limit"), Is.EqualTo(AuthConstants.MaxFuturePartiesPerOrganizer));

        var json = JsonSerializer.Serialize(result.Value, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        });
        using var document = JsonDocument.Parse(json);
        Assert.That(document.RootElement.GetProperty("code").GetString(), Is.EqualTo("future_party_limit_reached"));
        Assert.That(document.RootElement.GetProperty("limit").GetInt32(), Is.EqualTo(2));
    }

    private static Party Party(Guid organizerId, DateTime? eventDateTime, string shortCode) => new()
    {
        Id = Guid.NewGuid(),
        OrganizerId = organizerId,
        Name = shortCode,
        ShortCode = shortCode,
        PartyThemeId = PartyThemeDefaults.Id,
        Playlist = new PartyPlaylist(),
        CreatedAt = DateTime.UtcNow,
        EventDateTime = eventDateTime,
        PartyLifecycleState = PartyLifecycleState.Ready,
    };

    private static PartyService CreateService(
        Guid organizerId,
        IPartyRepository repository,
        IShortCodeGenerator? shortCodeGenerator = null,
        bool enforceFuturePartyLimit = false,
        IOptions<PartyLimitOptions>? partyLimitOptions = null)
    {
        var contextAccessor = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext(),
        };
        contextAccessor.HttpContext.Items["OrganizerId"] = organizerId;
        var options = partyLimitOptions ?? (enforceFuturePartyLimit
            ? Options.Create(new PartyLimitOptions { EnforceFuturePartyLimit = true })
            : null);
        return new PartyService(
            repository,
            new InMemoryStreamingRepository(),
            shortCodeGenerator ?? new SequenceShortCodeGenerator(),
            contextAccessor,
            new NoOpPlaylistNotifier(),
            new PartyAccessService(repository, NullLogger<PartyAccessService>.Instance),
            new RegressionThemeAccessService(),
            NullLogger<PartyService>.Instance,
            options);
    }

    private static PartiesController CreateController(
        Guid organizerId,
        IPartyRepository repository,
        bool enforceFuturePartyLimit = false)
    {
        var contextAccessor = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext(),
        };
        contextAccessor.HttpContext.Items["OrganizerId"] = organizerId;
        var controller = new PartiesController(
            CreateService(organizerId, repository, enforceFuturePartyLimit: enforceFuturePartyLimit),
            NullLogger<PartiesController>.Instance);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = contextAccessor.HttpContext,
        };
        return controller;
    }

    private static T ReadProperty<T>(object? value, string propertyName)
    {
        var property = value?.GetType().GetProperty(propertyName);
        Assert.That(property, Is.Not.Null);
        return (T)property!.GetValue(value)!;
    }

    private sealed class SequenceShortCodeGenerator : IShortCodeGenerator
    {
        private int _value;

        public Task<string> GenerateUniqueShortCodeAsync(Func<string, Task<bool>> uniquenessChecker, int maxRetries = 10)
        {
            var code = $"F{Interlocked.Increment(ref _value):00000}";
            return Task.FromResult(code);
        }
    }

    private sealed class NoOpPlaylistNotifier : IPartyPlaylistNotifier
    {
        public Task NotifyPlaylistChangedAsync(Guid partyId) => Task.CompletedTask;
    }
}
