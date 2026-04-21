using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CherryPlayServer.Infrastructure.Persistence;
using CherryPlayServer.Infrastructure.Persistence.Entities;
using CherryPlayServer.Core.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace CherryPlayServer.Tests.IntegrationDb;

[TestFixture]
[NonParallelizable]
[Category("IntegrationDb")]
public sealed class IntegrationDbTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private PostgresContainerFixture _postgresFixture = null!;

    [OneTimeSetUp]
    public async Task OneTimeSetUp()
    {
        _postgresFixture = new PostgresContainerFixture();
        await _postgresFixture.InitializeAsync();
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown()
    {
        await _postgresFixture.DisposeAsync();
    }

    [Test]
    public async Task DatabaseMigrate_FromZero_AppliesMigrations()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;

        await using var db = new AppDbContext(options);
        var before = await db.Database.GetAppliedMigrationsAsync();
        Assert.That(before, Is.Empty);

        await db.Database.MigrateAsync();

        var after = await db.Database.GetAppliedMigrationsAsync();
        var knownMigrations = db.Database.GetMigrations().ToArray();
        Assert.That(after, Is.Not.Empty);
        Assert.That(knownMigrations, Is.Not.Empty);
        foreach (var migrationId in knownMigrations)
        {
            Assert.That(after, Does.Contain(migrationId));
        }
    }

    [Test]
    public async Task AppStart_FreshDatabase_RunsMigrationsAndSeeding()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/config");
        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.OK));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var appliedMigrations = await db.Database.GetAppliedMigrationsAsync();
        var knownMigrations = db.Database.GetMigrations().ToArray();
        Assert.That(appliedMigrations, Is.Not.Empty);
        Assert.That(knownMigrations, Is.Not.Empty);
        foreach (var migrationId in knownMigrations)
        {
            Assert.That(appliedMigrations, Does.Contain(migrationId));
        }

        Assert.That(await db.Themes.AnyAsync(), Is.True, "Expected seeded themes.");
        Assert.That(await db.ThemePackages.AnyAsync(), Is.True, "Expected seeded theme packages.");
    }

    [Test]
    public async Task MigrationHistory_ContainsExpectedLatestMigration()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        _ = factory.CreateClient();

        await factory.WaitUntilDatabaseReachableAsync();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var appliedMigrations = await db.Database.GetAppliedMigrationsAsync();
        var knownMigrations = db.Database.GetMigrations().ToArray();

        Assert.That(appliedMigrations, Is.Not.Empty);
        Assert.That(knownMigrations, Is.Not.Empty);
        foreach (var migrationId in knownMigrations)
        {
            Assert.That(appliedMigrations, Does.Contain(migrationId));
        }
    }

    [Test]
    public async Task MonetizationSmoke_ThemeAccess_HidesPrivateAndShowsPublicLocked()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await SeedThemeAccessScenarioAsync(factory.Services);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await client.GetAsync("/api/organizer/me/theme-access");
        var body = await response.Content.ReadAsStringAsync();
        Assert.That(
            response.StatusCode == HttpStatusCode.OK,
            Is.True,
            $"Theme access failed with status {(int)response.StatusCode}: {body}");
        var payload = JsonSerializer.Deserialize<ThemeAccessResponse>(body, JsonOptions);
        Assert.That(payload, Is.Not.Null);

        Assert.That(payload!.GrantedThemeIds, Does.Contain("basic"));
        Assert.That(payload.VisibleLockedThemes.Any(x => x.ThemeId == "cyberpunk"), Is.False);
        Assert.That(payload.VisibleLockedThemes.Any(x => x.ThemeId == "sakura"), Is.True);
    }

    private static async Task<string> SeedThemeAccessScenarioAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var jwtService = scope.ServiceProvider.GetRequiredService<IJwtService>();

        var organizer = new OrganizerEf
        {
            Id = Guid.NewGuid(),
            Name = "Theme Access Organizer",
            Role = "organizer",
            CreatedAt = DateTime.UtcNow
        };
        var sessionId = Guid.NewGuid();

        db.Organizers.Add(organizer);
        db.OrganizerSessions.Add(new OrganizerSessionEf
        {
            Id = sessionId,
            OrganizerId = organizer.Id,
            CreatedAt = DateTime.UtcNow
        });
        var cyberpunkTheme = await db.Themes.SingleAsync(x => x.ThemeId == "cyberpunk");
        cyberpunkTheme.Visibility = "private";

        await db.SaveChangesAsync();

        return await jwtService.GenerateTokenAsync(
            organizer.Id,
            organizer.Name,
            sessionId,
            "organizer");
    }

    private sealed record ThemeAccessResponse(
        List<string> GrantedThemeIds,
        List<VisibleLockedThemeResponse> VisibleLockedThemes,
        string ContactUrl);

    private sealed record VisibleLockedThemeResponse(
        string ThemeId,
        string PackageCode,
        string PackageName);
}
