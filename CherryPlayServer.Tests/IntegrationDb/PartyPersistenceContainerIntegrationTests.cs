using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Infrastructure.Persistence.Repositories;
using CherryPlayServer.Core;
using CherryPlayServer.Core.Exceptions;
using CherryPlayServer.Core.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.AspNetCore.Http;
using Npgsql;

namespace CherryPlayServer.Tests.IntegrationDb;

[TestFixture]
[NonParallelizable]
[Category("ContainerIntegration")]
public sealed class PartyPersistenceContainerIntegrationTests
{
    [Test]
    public async Task PartyRepository_RoundTripsNestedPlaylistThroughFreshDbContext()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        var partyId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();
        var party = new Party
        {
            Id = partyId,
            OrganizerId = organizerId,
            Name = "Persistence case",
            Title = "Title",
            Subtitle = "Subtitle",
            ShortCode = $"P{Guid.NewGuid():N}"[..7],
            PartyThemeId = PartyThemeDefaults.Id,
            CreatedAt = DateTime.UtcNow,
            PartyLifecycleState = PartyLifecycleState.Ready,
            Playlist = new PartyPlaylist
            {
                TotalDuration = 425,
                TotalTracks = 2,
                Items = [
                    new PlayerItem { Id = "track-first", Type = PlayerItemType.Track, Name = "First", DisplayOrder = 0, Duration = 125 },
                    new PlayerItem
                    {
                        Id = "group-main",
                        Type = PlayerItemType.Group,
                        Name = "Main",
                        DisplayOrder = 1,
                        Items = [new PlayerItem { Id = "track-second", Type = PlayerItemType.Track, Name = "Second", DisplayOrder = 0, Duration = 300 }]
                    }
                ]
            }
        };

        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
            db.Organizers.Add(new OrganizerEf { Id = organizerId, Name = "Persistence organizer", Role = "organizer", CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            await new EfPartyRepository(db, NullLogger<EfPartyRepository>.Instance).AddAsync(party);
        }

        await using var readDb = new AppDbContext(options);
        var loaded = await new EfPartyRepository(readDb, NullLogger<EfPartyRepository>.Instance).GetByIdAsync(partyId);
        Assert.That(loaded, Is.Not.Null);
        Assert.That(loaded!.Name, Is.EqualTo("Persistence case"));
        Assert.That(loaded.Title, Is.EqualTo("Title"));
        Assert.That(loaded.Playlist.TotalDuration, Is.EqualTo(425));
        Assert.That(loaded.Playlist.TotalTracks, Is.EqualTo(2));
        Assert.That(loaded.Playlist.Items.Select(item => item.Id), Is.EqualTo(["track-first", "group-main"]));
        Assert.That(loaded.Playlist.Items[1].Items!.Single().Id, Is.EqualTo("track-second"));
        Assert.That(loaded.Playlist.Items[1].Items!.Single().Duration, Is.EqualTo(300));
    }

    [Test]
    public async Task StreamingRepository_RoundTripsPlaybackStateThroughFreshDbContext()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        var partyId = Guid.NewGuid();
        var organizerId = Guid.NewGuid();

        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
            db.Organizers.Add(new OrganizerEf { Id = organizerId, Name = "Playback organizer", Role = "organizer", CreatedAt = DateTime.UtcNow });
            db.Parties.Add(new PartyEf
            {
                Id = partyId,
                OrganizerId = organizerId,
                Name = "Playback party",
                ShortCode = $"S{Guid.NewGuid():N}"[..7],
                PartyThemeId = "basic",
                CreatedAt = DateTime.UtcNow,
                PartyLifecycleState = PartyLifecycleState.Ready
            });
            await db.SaveChangesAsync();
            await new EfStreamingRepository(db).SetSessionStateAsync(partyId, new PlaybackState
            {
                IsActive = false,
                CurrentTrackId = "track-a",
                Status = PlaybackStatus.Ended,
                Mode = PlaybackMode.Preparation,
                Position = 91.5,
                Duration = 240,
                Volume = 0.65,
                PlayedTrackIds = ["track-a", "track-b"],
                DisabledTrackIds = ["track-b"],
                DisabledGroupIds = ["group-a"],
                SessionStartedAt = DateTime.UtcNow.AddMinutes(-10),
                LastUpdatedAt = DateTime.UtcNow
            });
        }

        await using var readDb = new AppDbContext(options);
        var state = await new EfStreamingRepository(readDb).GetSessionStateAsync(partyId);
        Assert.That(state, Is.Not.Null);
        Assert.That(state!.IsActive, Is.False);
        Assert.That(state.CurrentTrackId, Is.EqualTo("track-a"));
        Assert.That(state.Status, Is.EqualTo(PlaybackStatus.Ended));
        Assert.That(state.Mode, Is.EqualTo(PlaybackMode.Preparation));
        Assert.That(state.Position, Is.EqualTo(91.5));
        Assert.That(state.Duration, Is.EqualTo(240));
        Assert.That(state.Volume, Is.EqualTo(0.65));
        Assert.That(state.PlayedTrackIds, Is.EqualTo(["track-a", "track-b"]));
        Assert.That(state.DisabledTrackIds, Is.EqualTo(["track-b"]));
        Assert.That(state.DisabledGroupIds, Is.EqualTo(["group-a"]));
        Assert.That(state.SessionStartedAt, Is.Not.Null);
    }

    [Test]
    public async Task DatabaseMigrations_CanBeAppliedTwiceWithoutChangingData()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        await using var db = new AppDbContext(options);
        await db.Database.MigrateAsync();
        var registryCount = await db.LegalDocumentVersions.CountAsync();
        var organizerId = Guid.NewGuid();
        db.Organizers.Add(new OrganizerEf { Id = organizerId, Name = "Migration data", Role = "organizer", CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        await db.Database.MigrateAsync();

        Assert.That(await db.LegalDocumentVersions.CountAsync(), Is.EqualTo(registryCount));
        Assert.That(await db.Organizers.IgnoreQueryFilters().CountAsync(item => item.Id == organizerId), Is.EqualTo(1));
    }

    [Test]
    public async Task DatabaseMigrations_FromPreviousSchema_PreservePartyAndPlaybackData()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        var organizerId = Guid.NewGuid();
        var partyId = Guid.NewGuid();
        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync("20260529084208_AddPartyLifecycleState");
        }

        await using (var connection = new NpgsqlConnection(database.ConnectionString))
        {
            await connection.OpenAsync();
            await using var command = connection.CreateCommand();
            command.Parameters.AddWithValue("organizerId", organizerId);
            command.Parameters.AddWithValue("createdAt", DateTime.UtcNow);
            command.CommandText = "INSERT INTO organizers (id, name, role, created_at, is_deleted) VALUES (@organizerId, 'Migrating organizer', 'organizer', @createdAt, FALSE)";
            await command.ExecuteNonQueryAsync();
            command.Parameters.Clear();
            command.Parameters.AddWithValue("partyId", partyId);
            command.Parameters.AddWithValue("organizerId", organizerId);
            command.Parameters.AddWithValue("shortCode", $"M{Guid.NewGuid():N}"[..7]);
            command.Parameters.AddWithValue("createdAt", DateTime.UtcNow);
            command.CommandText = "INSERT INTO parties (id, organizer_id, name, short_code, party_theme_id, is_listed_in_catalog, created_at, is_deleted, party_lifecycle_state) VALUES (@partyId, @organizerId, 'Migrating party', @shortCode, 'basic', TRUE, @createdAt, FALSE, 2)";
            await command.ExecuteNonQueryAsync();
            command.Parameters.Clear();
            command.Parameters.AddWithValue("partyId", partyId);
            command.CommandText = "INSERT INTO party_playlists (party_id, items, total_duration, total_tracks) VALUES (@partyId, '[{\"Id\":\"track-a\",\"Type\":0,\"Name\":\"Track A\",\"DisplayOrder\":0,\"Level\":0,\"Duration\":180,\"Items\":null}]'::jsonb, 180, 1)";
            await command.ExecuteNonQueryAsync();
            command.Parameters.Clear();
            command.Parameters.AddWithValue("partyId", partyId);
            command.Parameters.AddWithValue("createdAt", DateTime.UtcNow);
            command.CommandText = "INSERT INTO session_states (party_id, is_active, current_track_id, status, position, duration, volume, mode, played_track_ids, disabled_track_ids, disabled_group_ids, last_updated_at) VALUES (@partyId, TRUE, 'track-a', 'playing', 22, 180, 0.8, 'session', '[\"track-a\"]'::jsonb, '[]'::jsonb, '[]'::jsonb, @createdAt)";
            await command.ExecuteNonQueryAsync();
        }

        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
        }

        await using var readDb = new AppDbContext(options);
        var party = await new EfPartyRepository(readDb, NullLogger<EfPartyRepository>.Instance).GetByIdAsync(partyId);
        var state = await new EfStreamingRepository(readDb).GetSessionStateAsync(partyId);
        Assert.That(party, Is.Not.Null);
        Assert.That(party!.Name, Is.EqualTo("Migrating party"));
        Assert.That(party.Playlist.Items.Single().Id, Is.EqualTo("track-a"));
        Assert.That(state!.CurrentTrackId, Is.EqualTo("track-a"));
        Assert.That(state.Position, Is.EqualTo(22));
    }

    [Test]
    public async Task AppUnitOfWork_RollbackRestoresOrganizerAndSessions()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        var organizerId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        await using (var seedDb = new AppDbContext(options))
        {
            await seedDb.Database.MigrateAsync();
            await seedDb.Organizers.AddAsync(new OrganizerEf
            {
                Id = organizerId,
                Name = "Retained organizer",
                Role = "organizer",
                CreatedAt = DateTime.UtcNow,
                LogoUrl = "https://example.invalid/logo.png"
            });
            await seedDb.OrganizerSessions.AddAsync(new OrganizerSessionEf
            {
                Id = sessionId,
                OrganizerId = organizerId,
                CreatedAt = DateTime.UtcNow
            });
            await seedDb.SaveChangesAsync();
        }

        await using (var db = new AppDbContext(options))
        {
            var organizers = new EfOrganizerRepository(db);
            var emails = new EfEmailAccountRepository(db);
            var oauth = new EfOAuthAccountRepository(db);
            var sessions = new EfOrganizerSessionRepository(db);
            var unitOfWork = new EfAppUnitOfWork(db, organizers, emails, oauth, sessions);
            await unitOfWork.BeginTransactionAsync();
            var organizer = await organizers.GetByIdForUpdateAsync(organizerId);
            organizer!.Name = OrganizerDisplayNames.Deleted;
            organizer.LogoUrl = null;
            await organizers.UpdateAsync(organizer);
            await sessions.RemoveAllByOrganizerIdAsync(organizerId);
            await organizers.DeleteAsync(organizerId);
            await unitOfWork.RollbackAsync();
        }

        await using var verifyDb = new AppDbContext(options);
        var savedOrganizer = await new EfOrganizerRepository(verifyDb).GetByIdAsync(organizerId);
        Assert.That(savedOrganizer!.Name, Is.EqualTo("Retained organizer"));
        Assert.That(savedOrganizer.LogoUrl, Is.EqualTo("https://example.invalid/logo.png"));
        Assert.That(await verifyDb.OrganizerSessions.CountAsync(item => item.Id == sessionId), Is.EqualTo(1));
    }

    [Test]
    public async Task PasswordResetTokenCleanup_RepeatedRunsAreIdempotentAndKeepFreshRecords()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        var organizerId = Guid.NewGuid();
        var emailAccountId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var oldUsedId = Guid.NewGuid();
        var oldUnusedId = Guid.NewGuid();
        var freshUsedId = Guid.NewGuid();
        var activeId = Guid.NewGuid();
        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
            db.Organizers.Add(new OrganizerEf { Id = organizerId, Name = "Retention organizer", Role = "organizer", CreatedAt = now });
            db.EmailAccounts.Add(new EmailAccountEf
            {
                Id = emailAccountId,
                OrganizerId = organizerId,
                Email = $"retention-{Guid.NewGuid():N}@example.invalid",
                PasswordHash = "hash",
                CreatedAt = now
            });
            db.PasswordResetTokens.AddRange(
                new PasswordResetTokenEf { Id = oldUsedId, EmailAccountId = emailAccountId, TokenHash = Guid.NewGuid().ToString("N"), CreatedAt = now.AddDays(-40), ExpiresAt = now.AddDays(-39), UsedAt = now.AddDays(-35) },
                new PasswordResetTokenEf { Id = oldUnusedId, EmailAccountId = emailAccountId, TokenHash = Guid.NewGuid().ToString("N"), CreatedAt = now.AddDays(-40), ExpiresAt = now.AddDays(-35) },
                new PasswordResetTokenEf { Id = freshUsedId, EmailAccountId = emailAccountId, TokenHash = Guid.NewGuid().ToString("N"), CreatedAt = now.AddDays(-5), ExpiresAt = now.AddDays(-4), UsedAt = now.AddDays(-1) },
                new PasswordResetTokenEf { Id = activeId, EmailAccountId = emailAccountId, TokenHash = Guid.NewGuid().ToString("N"), CreatedAt = now, ExpiresAt = now.AddMinutes(10) });
            await db.SaveChangesAsync();
        }

        int firstRun;
        int secondRun;
        await using (var db = new AppDbContext(options))
        {
            var repository = new EfPasswordResetTokenRepository(db);
            firstRun = await repository.DeleteStaleAsync(now, AuthConstants.PasswordResetTokenRecordRetention);
            secondRun = await repository.DeleteStaleAsync(now, AuthConstants.PasswordResetTokenRecordRetention);
        }

        Assert.That(firstRun, Is.EqualTo(2));
        Assert.That(secondRun, Is.Zero);
        await using var verifyDb = new AppDbContext(options);
        Assert.That(await verifyDb.PasswordResetTokens.AnyAsync(item => item.Id == freshUsedId), Is.True);
        Assert.That(await verifyDb.PasswordResetTokens.AnyAsync(item => item.Id == activeId), Is.True);
        Assert.That(await verifyDb.PasswordResetTokens.AnyAsync(item => item.Id == oldUsedId || item.Id == oldUnusedId), Is.False);
    }

    [Test]
    public async Task PartyService_ConcurrentCreationAtFutureLimitDoesNotExceedLimit()
    {
        await using var database = await ContainerIntegrationDatabase.CreateAsync();
        var options = CreateOptions(database.ConnectionString);
        var organizerId = Guid.NewGuid();
        await using (var db = new AppDbContext(options))
        {
            await db.Database.MigrateAsync();
            db.Organizers.Add(new OrganizerEf { Id = organizerId, Name = "Limit organizer", Role = "organizer", CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
            await new EfPartyRepository(db, NullLogger<EfPartyRepository>.Instance).AddAsync(new Party
            {
                Id = Guid.NewGuid(),
                OrganizerId = organizerId,
                Name = "Existing future party",
                ShortCode = $"E{Guid.NewGuid():N}"[..7],
                PartyThemeId = PartyThemeDefaults.Id,
                Playlist = new PartyPlaylist(),
                CreatedAt = DateTime.UtcNow,
                EventDateTime = DateTime.UtcNow.AddDays(1),
                PartyLifecycleState = PartyLifecycleState.Ready
            });
        }

        var generator = new ConcurrentPartyShortCodeGenerator(2);
        var attempts = await Task.WhenAll(Enumerable.Range(0, 2).Select(async index =>
        {
            await using var db = new AppDbContext(options);
            var repo = new EfPartyRepository(db, NullLogger<EfPartyRepository>.Instance);
            var httpContext = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
            httpContext.HttpContext!.Items["OrganizerId"] = organizerId;
            var service = new PartyService(
                repo,
                new EfStreamingRepository(db),
                generator,
                httpContext,
                new RegressionPlaylistNotifier(),
                new PartyAccessService(repo, NullLogger<PartyAccessService>.Instance),
                new RegressionThemeAccessService(),
                NullLogger<PartyService>.Instance);
            try
            {
                await service.CreatePartyAsync(new CherryPlayServer.Models.CreatePartyDto
                {
                    Name = $"Concurrent future party {index}",
                    EventDateTime = DateTime.UtcNow.AddDays(2),
                    PartyThemeId = PartyThemeDefaults.Id
                });
                return true;
            }
            catch (PartyLimitReachedException)
            {
                return false;
            }
        }));

        Assert.That(attempts.Count(result => result), Is.EqualTo(1));
        await using var countDb = new AppDbContext(options);
        Assert.That(await new EfPartyRepository(countDb, NullLogger<EfPartyRepository>.Instance).GetByOrganizerIdAsync(organizerId),
            Has.Count.EqualTo(AuthConstants.MaxFuturePartiesPerOrganizer));
    }

    private static DbContextOptions<AppDbContext> CreateOptions(string connectionString) =>
        new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;
}
