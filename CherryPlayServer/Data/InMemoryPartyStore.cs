using CherryPlayServer.Models;

namespace CherryPlayServer.Data;

public class InMemoryPartyStore
{
    private readonly List<Party> _parties = new();
    private readonly Dictionary<Guid, PlaybackStateDto> _sessions = new();

    public Party? GetFirstParty()
    {
        return _parties.FirstOrDefault();
    }

    public Party? GetPartyByShortCode(string shortCode)
    {
        return _parties.FirstOrDefault(p => p.ShortCode == shortCode);
    }

    public Party? GetPartyById(Guid id)
    {
        return _parties.FirstOrDefault(p => p.Id == id);
    }

    public List<Party> GetAllParties()
    {
        return _parties.ToList();
    }

    public void AddParty(Party party)
    {
        _parties.Add(party);
    }

    public PlaybackStateDto? GetSessionState(Guid partyId)
    {
        return _sessions.TryGetValue(partyId, out var state) ? state : null;
    }

    public void SetSessionState(Guid partyId, PlaybackStateDto state)
    {
        _sessions[partyId] = state;
    }

    public void InitializeWithSampleData()
    {
        if (_parties.Any()) return;

        var sampleParty = new Party
        {
            Id = Guid.NewGuid(),
            Name = "Sample Party",
            ShortCode = "sample",
            StyleId = "cyberpunk",
            Playlist = new PartyPlaylistDto
            {
                Items = new List<PlayerItem>
                {
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = "track",
                        Name = "Track 1",
                        Path = "/path/to/track1.mp3",
                        Duration = 180,
                        DisplayOrder = 0,
                        Level = 0
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = "track",
                        Name = "Track 2",
                        Path = "/path/to/track2.mp3",
                        Duration = 240,
                        DisplayOrder = 1,
                        Level = 0
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = "group",
                        Name = "Group 1",
                        DisplayOrder = 2,
                        Level = 0,
                        Items = new List<PlayerItem>
                        {
                            new PlayerItem
                            {
                                Id = Guid.NewGuid().ToString(),
                                Type = "track",
                                Name = "Track 3",
                                Path = "/path/to/track3.mp3",
                                Duration = 200,
                                DisplayOrder = 0,
                                Level = 1
                            }
                        }
                    }
                },
                TotalDuration = 620,
                TotalTracks = 3
            }
        };

        _parties.Add(sampleParty);
    }
}

