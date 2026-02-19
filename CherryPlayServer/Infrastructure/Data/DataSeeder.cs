using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Data;

public class DataSeeder : IDataSeeder
{
    private readonly IPartyRepository _partyRepository;
    private readonly IOrganizerRepository _organizerRepository;
    private readonly IEmailAccountRepository _emailAccountRepository;
    private readonly IPasswordHasher _passwordHasher;

    public DataSeeder(
        IPartyRepository partyRepository,
        IOrganizerRepository organizerRepository,
        IEmailAccountRepository emailAccountRepository,
        IPasswordHasher passwordHasher)
    {
        _partyRepository = partyRepository;
        _organizerRepository = organizerRepository;
        _emailAccountRepository = emailAccountRepository;
        _passwordHasher = passwordHasher;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        // Создание тестового пользователя (временное решение для тестов)
        var testEmail = "t@t.ru";
        var existingTestAccount = await _emailAccountRepository.GetByEmailAsync(testEmail);
        if (existingTestAccount == null)
        {
            var testOrganizer = new Organizer
            {
                Id = Guid.NewGuid(),
                Name = "Test User",
                CreatedAt = DateTime.UtcNow
            };
            await _organizerRepository.AddAsync(testOrganizer);

            var testEmailAccount = new EmailAccount
            {
                Id = Guid.NewGuid(),
                OrganizerId = testOrganizer.Id,
                Email = testEmail.ToLowerInvariant().Trim(),
                PasswordHash = _passwordHasher.HashPassword("123456"),
                CreatedAt = DateTime.UtcNow,
                LastUsedAt = DateTime.UtcNow
            };
            await _emailAccountRepository.AddAsync(testEmailAccount);
        }

        var existingParties = await _partyRepository.GetAllAsync();
        if (existingParties.Any()) return;

        // Cyberpunk вечеринка
        var cyberpunkParty = new Party
        {
            Id = Guid.NewGuid(),
            Name = "Cyberpunk Night",
            ShortCode = "cyber",
            ThemeId = ThemeId.Cyberpunk,
            CustomizationSettings = new Dictionary<string, object>
            {
                { "accentColor", "#00ff00" },
                { "glowIntensity", 0.8 }
            },
            Playlist = new PartyPlaylist
            {
                Items =
                [
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Track,
                        Name = "Neon Dreams",
                        DisplayOrder = 0,
                        Level = 0,
                        Duration = 245
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Track,
                        Name = "Digital Pulse",
                        DisplayOrder = 1,
                        Level = 0,
                        Duration = 320
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Group,
                        Name = "Synthwave Collection",
                        DisplayOrder = 2,
                        Level = 0,
                        Items =
                        [
                            new PlayerItem
                            {
                                Id = Guid.NewGuid().ToString(),
                                Type = PlayerItemType.Track,
                                Name = "Retro Future",
                                DisplayOrder = 0,
                                Level = 1,
                                Duration = 280
                            },
                            new PlayerItem
                            {
                                Id = Guid.NewGuid().ToString(),
                                Type = PlayerItemType.Track,
                                Name = "Electric City",
                                DisplayOrder = 1,
                                Level = 1,
                                Duration = 195
                            }
                        ]
                    }
                ],
                TotalDuration = 1040,
                TotalTracks = 4
            },
            CreatedAt = DateTime.UtcNow,
            EventDateTime = DateTime.UtcNow.AddDays(7),
            IsListedInCatalog = true,
            Description = "Ночная вечеринка в стиле киберпанк."
        };

        // Sakura вечеринка
        var sakuraParty = new Party
        {
            Id = Guid.NewGuid(),
            Name = "Sakura Festival",
            ShortCode = "sakura",
            ThemeId = ThemeId.Sakura,
            CustomizationSettings = new Dictionary<string, object>
            {
                { "pinkTint", 0.6 },
                { "backgroundOpacity", 0.9 }
            },
            Playlist = new PartyPlaylist
            {
                Items =
                [
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Track,
                        Name = "Cherry Blossom",
                        DisplayOrder = 0,
                        Level = 0,
                        Duration = 210
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Track,
                        Name = "Spring Breeze",
                        DisplayOrder = 1,
                        Level = 0,
                        Duration = 185
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Group,
                        Name = "Peaceful Moments",
                        DisplayOrder = 2,
                        Level = 0,
                        Items =
                        [
                            new PlayerItem
                            {
                                Id = Guid.NewGuid().ToString(),
                                Type = PlayerItemType.Track,
                                Name = "Garden Walk",
                                DisplayOrder = 0,
                                Level = 1,
                                Duration = 240
                            }
                        ]
                    }
                ],
                TotalDuration = 635,
                TotalTracks = 3
            },
            CreatedAt = DateTime.UtcNow,
            EventDateTime = DateTime.UtcNow.AddDays(14),
            IsListedInCatalog = true,
            Description = "Фестиваль цветения сакуры."
        };

        // Art Deco вечеринка
        var artDecoParty = new Party
        {
            Id = Guid.NewGuid(),
            Name = "Art Deco Gala",
            ShortCode = "artdeco",
            ThemeId = ThemeId.ArtDeco,
            CustomizationSettings = new Dictionary<string, object>
            {
                { "goldColor", "#d4af37" },
                { "patternStyle", "geometric" }
            },
            Playlist = new PartyPlaylist
            {
                Items =
                [
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Track,
                        Name = "Roaring Twenties",
                        DisplayOrder = 0,
                        Level = 0,
                        Duration = 195
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Track,
                        Name = "Golden Age",
                        DisplayOrder = 1,
                        Level = 0,
                        Duration = 220
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Track,
                        Name = "Elegant Evening",
                        DisplayOrder = 2,
                        Level = 0,
                        Duration = 275
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Group,
                        Name = "Jazz Collection",
                        DisplayOrder = 3,
                        Level = 0,
                        Items =
                        [
                            new PlayerItem
                            {
                                Id = Guid.NewGuid().ToString(),
                                Type = PlayerItemType.Track,
                                Name = "Smooth Jazz",
                                DisplayOrder = 0,
                                Level = 1,
                                Duration = 310
                            },
                            new PlayerItem
                            {
                                Id = Guid.NewGuid().ToString(),
                                Type = PlayerItemType.Track,
                                Name = "Midnight Swing",
                                DisplayOrder = 1,
                                Level = 1,
                                Duration = 245
                            }
                        ]
                    }
                ],
                TotalDuration = 1245,
                TotalTracks = 5
            },
            CreatedAt = DateTime.UtcNow,
            EventDateTime = DateTime.UtcNow.AddDays(21),
            IsListedInCatalog = false
        };

        // Базовый вечеринка
        var basicParty = new Party
        {
            Id = Guid.NewGuid(),
            Name = "Базовый плейлист",
            ShortCode = "basic",
            ThemeId = ThemeId.Basic,
            CustomizationSettings = null,
            Playlist = new PartyPlaylist
            {
                Items =
                [
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Track,
                        Name = "Трек 1",
                        DisplayOrder = 0,
                        Level = 0,
                        Duration = 180
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Track,
                        Name = "Трек 2",
                        DisplayOrder = 1,
                        Level = 0,
                        Duration = 240
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Group,
                        Name = "Группа треков",
                        DisplayOrder = 2,
                        Level = 0,
                        Items =
                        [
                            new PlayerItem
                            {
                                Id = Guid.NewGuid().ToString(),
                                Type = PlayerItemType.Track,
                                Name = "Трек в группе 1",
                                DisplayOrder = 0,
                                Level = 1,
                                Duration = 200
                            },
                            new PlayerItem
                            {
                                Id = Guid.NewGuid().ToString(),
                                Type = PlayerItemType.Track,
                                Name = "Трек в группе 2",
                                DisplayOrder = 1,
                                Level = 1,
                                Duration = 195
                            }
                        ]
                    },
                    new PlayerItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        Type = PlayerItemType.Track,
                        Name = "Трек 3",
                        DisplayOrder = 3,
                        Level = 0,
                        Duration = 220
                    }
                ],
                TotalDuration = 1035,
                TotalTracks = 5
            },
            CreatedAt = DateTime.UtcNow,
            EventDateTime = DateTime.UtcNow.AddDays(3),
            IsListedInCatalog = true
        };

        await _partyRepository.AddAsync(cyberpunkParty);
        await _partyRepository.AddAsync(sakuraParty);
        await _partyRepository.AddAsync(artDecoParty);
        await _partyRepository.AddAsync(basicParty);
    }
}
