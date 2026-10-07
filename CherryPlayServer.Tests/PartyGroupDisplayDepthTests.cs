using System.Text.Json;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Mappings;
using CherryPlayServer.Core.Services;
using CherryPlayServer.Infrastructure.Persistence.Mappings;
using CherryPlayServer.Infrastructure.Repositories;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;

namespace CherryPlayServer.Tests;

public sealed class PartyGroupDisplayDepthTests
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Test]
    public async Task CreateParty_PreservesGroupDisplayDepthInCustomizationSettings()
    {
        var partyRepository = new InMemoryPartyRepository();
        var service = CreateService(partyRepository);
        var dto = JsonSerializer.Deserialize<CreatePartyDto>("""
            {"name":"Display depth","customizationSettings":{"groupDisplayDepth":7,"accent":"#abc"}}
            """, JsonOptions)!;

        var created = await service.CreatePartyAsync(dto);
        var saved = (await partyRepository.GetAllAsync()).Single();

        Assert.That(ReadSetting(created.CustomizationSettings, "groupDisplayDepth"), Is.EqualTo(7));
        Assert.That(ReadSetting(created.CustomizationSettings, "accent"), Is.EqualTo("#abc"));
        Assert.That(saved.CustomizationSettings, Does.ContainKey("groupDisplayDepth"));
    }

    [Test]
    public async Task UpdatePartyMetadata_PreservesGroupDisplayDepthInCustomizationSettings()
    {
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        var partyRepository = new InMemoryPartyRepository();
        await partyRepository.AddAsync(new Party
        {
            Id = partyId,
            OrganizerId = organizerId,
            Name = "Display depth",
            ShortCode = "DEPTH1",
            PartyThemeId = PartyThemeDefaults.Id,
            CustomizationSettings = new Dictionary<string, object> { ["groupDisplayDepth"] = 3 },
        });
        var service = CreateService(partyRepository, organizerId);
        var dto = JsonSerializer.Deserialize<UpdatePartyDto>("""
            {"customizationSettings":{"groupDisplayDepth":8,"accent":"#def"}}
            """, JsonOptions)!;

        await service.UpdatePartyMetadataAsync(partyId, dto);

        var updated = await partyRepository.GetByIdAsync(partyId);
        Assert.That(ReadSetting(updated!.CustomizationSettings, "groupDisplayDepth"), Is.EqualTo(8));
        Assert.That(ReadSetting(updated.CustomizationSettings, "accent"), Is.EqualTo("#def"));
    }

    [Test]
    public void CustomizationSettings_PreserveGroupDisplayDepthThroughEfAndPartyDtos()
    {
        var party = new Party
        {
            Id = Guid.NewGuid(),
            OrganizerId = Guid.NewGuid(),
            Name = "Display depth",
            ShortCode = "DEPTH2",
            PartyThemeId = PartyThemeDefaults.Id,
            CustomizationSettings = new Dictionary<string, object>
            {
                ["groupDisplayDepth"] = 6,
                ["accent"] = "#123",
            },
        };

        var stored = party.ToEf();
        var loaded = stored.ToDomain();
        var ownerDto = loaded.ToDto(false);
        var publicDto = loaded.ToPublicDto(false, PartyDisplayStatus.Scheduled);

        Assert.That(stored.CustomizationSettingsJson, Does.Contain("\"groupDisplayDepth\":6"));
        Assert.That(ReadSetting(loaded.CustomizationSettings, "groupDisplayDepth"), Is.EqualTo(6));
        Assert.That(ReadSetting(ownerDto.CustomizationSettings, "groupDisplayDepth"), Is.EqualTo(6));
        Assert.That(ReadSetting(publicDto.CustomizationSettings, "groupDisplayDepth"), Is.EqualTo(6));
    }

    private static PartyService CreateService(InMemoryPartyRepository partyRepository, Guid? organizerId = null)
    {
        var contextAccessor = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
        contextAccessor.HttpContext!.Items["OrganizerId"] = organizerId ?? Guid.NewGuid();

        return new PartyService(
            partyRepository,
            new InMemoryStreamingRepository(),
            new RegressionShortCodeGenerator(),
            contextAccessor,
            new RegressionPlaylistNotifier(),
            new PartyAccessService(partyRepository, NullLogger<PartyAccessService>.Instance),
            new RegressionThemeAccessService(),
            NullLogger<PartyService>.Instance);
    }

    private static object? ReadSetting(Dictionary<string, object>? settings, string key)
    {
        if (settings == null || !settings.TryGetValue(key, out var value))
        {
            return null;
        }

        return value is JsonElement element
            ? element.ValueKind == JsonValueKind.Number ? element.GetInt32() : element.GetString()
            : value;
    }
}
