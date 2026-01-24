using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Data;

public class DataSeeder : IDataSeeder
{
    private readonly IPartyRepository _partyRepository;

    public DataSeeder(IPartyRepository partyRepository)
    {
        _partyRepository = partyRepository;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var existingParties = await _partyRepository.GetAllAsync();
        if (existingParties.Any()) return;

        var sampleParty = new Party
        {
            Id = Guid.NewGuid(),
            Name = "Sample Party",
            ShortCode = "sample",
            ThemeId = ThemeId.Cyberpunk,
            Playlist = new PartyPlaylist
            {
                Items =
                [
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Track,
                        Name = "Track 1",
                        DisplayOrder = 0,
                        Level = 0,
                        Path = "/path/to/track1.mp3",
                        Duration = 180
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Track,
                        Name = "Track 2",
                        DisplayOrder = 1,
                        Level = 0,
                        Path = "/path/to/track2.mp3",
                        Duration = 240
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Group,
                        Name = "Group 1",
                        DisplayOrder = 2,
                        Level = 0,
                        Items =
                        [
                            new PlayerItem
                            {
                                Id = Guid.NewGuid().ToString(),
                                Type = PlayerItemType.Track,
                                Name = "Track 3",
                                DisplayOrder = 0,
                                Level = 1,
                                Path = "/path/to/track3.mp3",
                                Duration = 200
                            }
                        ]
                    }
                ],
                TotalDuration = 620,
                TotalTracks = 3
            }
        };

        await _partyRepository.AddAsync(sampleParty);
    }
}
