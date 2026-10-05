using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Infrastructure.Data;

public class DataSeeder : IDataSeeder
{
    private static readonly Guid PdConsentVersionId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid TermsVersionId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private const string PdConsentHash =
        "1ec5bcae20671f7083e7a3a58525d7d628c7aa1b6b20c0462aea46a09ccd5f6f";
    private const string TermsHash =
        "c9290febb6dce3229775dba33b7a766a09f769963f82331ccd34dc274f32334d";

    private readonly IPartyRepository _partyRepository;
    private readonly IOrganizerRepository _organizerRepository;
    private readonly IEmailAccountRepository _emailAccountRepository;
    private readonly IConsentEventRepository _consentEventRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IThemeCatalogSeeder _themeCatalogSeeder;

    public DataSeeder(
        IPartyRepository partyRepository,
        IOrganizerRepository organizerRepository,
        IEmailAccountRepository emailAccountRepository,
        IConsentEventRepository consentEventRepository,
        IPasswordHasher passwordHasher,
        IThemeCatalogSeeder themeCatalogSeeder)
    {
        _partyRepository = partyRepository;
        _organizerRepository = organizerRepository;
        _emailAccountRepository = emailAccountRepository;
        _consentEventRepository = consentEventRepository;
        _passwordHasher = passwordHasher;
        _themeCatalogSeeder = themeCatalogSeeder;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        await _themeCatalogSeeder.SeedAsync(cancellationToken);

        var testEmail = "t@t.ru";
        Guid demoOrganizerId;
        var existingTestAccount = await _emailAccountRepository.GetByEmailAsync(testEmail);
        if (existingTestAccount == null)
        {
            var testOrganizer = new Organizer
            {
                Id = Guid.NewGuid(),
                Name = "Test User",
                Role = OrganizerRole.Admin,
                CreatedAt = DateTime.UtcNow
            };
            await _organizerRepository.AddAsync(testOrganizer);
            demoOrganizerId = testOrganizer.Id;

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
        else
        {
            demoOrganizerId = existingTestAccount.OrganizerId;
            var existingOrganizer = await _organizerRepository.GetByIdAsync(demoOrganizerId);
            if (existingOrganizer is not null && existingOrganizer.Role != OrganizerRole.Admin)
            {
                existingOrganizer.Role = OrganizerRole.Admin;
                await _organizerRepository.UpdateAsync(existingOrganizer);
            }
        }

        await EnsureActiveGrantsAsync(demoOrganizerId);

        await EnsureLegacyOrganizerWithoutConsentsAsync();

        var existingParties = await _partyRepository.GetAllAsync();
        if (existingParties.Any()) return;

        var cyberpunkParty = new Party
        {
            Id = Guid.NewGuid(),
            OrganizerId = demoOrganizerId,
            Name = "Cyberpunk Night",
            ShortCode = "cyber",
            PartyThemeId = PartyThemeId.Cyberpunk,
            CustomizationSettings = null,
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

        var sakuraParty = new Party
        {
            Id = Guid.NewGuid(),
            OrganizerId = demoOrganizerId,
            Name = "Sakura Festival",
            ShortCode = "sakura",
            PartyThemeId = PartyThemeId.Sakura,
            CustomizationSettings = null,
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

        var artDecoParty = new Party
        {
            Id = Guid.NewGuid(),
            OrganizerId = demoOrganizerId,
            Name = "Art Deco Gala",
            ShortCode = "artdeco",
            PartyThemeId = PartyThemeId.ArtDeco,
            CustomizationSettings = null,
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

        var basicParty = new Party
        {
            Id = Guid.NewGuid(),
            OrganizerId = demoOrganizerId,
            Name = "Базовый плейлист",
            ShortCode = "basic",
            PartyThemeId = PartyThemeId.Basic,
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

    private async Task EnsureLegacyOrganizerWithoutConsentsAsync()
    {
        const string legacyEmail = "legacy@t.ru";
        var existing = await _emailAccountRepository.GetByEmailAsync(legacyEmail);
        if (existing is not null)
        {
            return;
        }

        var organizer = new Organizer
        {
            Id = Guid.NewGuid(),
            Name = "Legacy User",
            Role = OrganizerRole.Organizer,
            CreatedAt = DateTime.UtcNow
        };
        await _organizerRepository.AddAsync(organizer);

        await _emailAccountRepository.AddAsync(new EmailAccount
        {
            Id = Guid.NewGuid(),
            OrganizerId = organizer.Id,
            Email = legacyEmail,
            PasswordHash = _passwordHasher.HashPassword("123456"),
            CreatedAt = DateTime.UtcNow,
            LastUsedAt = DateTime.UtcNow
        });
    }

    private async Task EnsureActiveGrantsAsync(Guid subjectId)
    {
        var existing = await _consentEventRepository.ListBySubjectAsync(subjectId);
        var hasPd = existing.Any(e =>
            e.LegalDocumentVersionId == PdConsentVersionId && e.Decision == ConsentDecision.Grant);
        var hasTerms = existing.Any(e =>
            e.LegalDocumentVersionId == TermsVersionId && e.Decision == ConsentDecision.Grant);

        var now = DateTimeOffset.UtcNow;
        if (!hasPd)
        {
            await _consentEventRepository.TryAddAsync(new ConsentEvent
            {
                Id = Guid.NewGuid(),
                SubjectId = subjectId,
                LegalDocumentVersionId = PdConsentVersionId,
                DocumentHash = PdConsentHash,
                Decision = ConsentDecision.Grant,
                EventAt = now
            });
        }

        if (!hasTerms)
        {
            await _consentEventRepository.TryAddAsync(new ConsentEvent
            {
                Id = Guid.NewGuid(),
                SubjectId = subjectId,
                LegalDocumentVersionId = TermsVersionId,
                DocumentHash = TermsHash,
                Decision = ConsentDecision.Grant,
                EventAt = now
            });
        }
    }

}
