using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class PartyServiceLogPrivacyTests
{
    [Test]
    public async Task CreateParty_LogsOrganizerAndPartyIdsWithoutNameOrShortCode()
    {
        var organizerId = Guid.NewGuid();
        var loggerProvider = new CapturingLoggerProvider();
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddProvider(loggerProvider));
        var httpContextAccessor = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
        httpContextAccessor.HttpContext!.Items["OrganizerId"] = organizerId;
        var partyRepository = new InMemoryPartyRepository();
        var service = new PartyService(
            partyRepository,
            new InMemoryStreamingRepository(),
            new RegressionShortCodeGenerator(),
            httpContextAccessor,
            new RegressionPlaylistNotifier(),
            new PartyAccessService(partyRepository, NullLogger<PartyAccessService>.Instance),
            new RegressionThemeAccessService(),
            loggerFactory.CreateLogger<PartyService>());
        const string partyName = "private party name";
        const string shortCode = "REGRE01";

        var party = await service.CreatePartyAsync(new CreatePartyDto { Name = partyName });

        var log = string.Join(Environment.NewLine, loggerProvider.Messages);
        Assert.That(log, Does.Contain(organizerId.ToString()));
        Assert.That(log, Does.Contain(party.Id.ToString()));
        Assert.That(log, Does.Not.Contain(partyName));
        Assert.That(log, Does.Not.Contain(shortCode));
    }
}
