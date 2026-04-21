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

[CollectionDefinition("IntegrationDb", DisableParallelization = true)]
public sealed class IntegrationDbCollectionDefinition : ICollectionFixture<PostgresContainerFixture>;

[Collection("IntegrationDb")]
[Trait("Category", "IntegrationDb")]
public sealed class IntegrationDbTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly PostgresContainerFixture _postgresFixture;

    public IntegrationDbTests(PostgresContainerFixture postgresFixture)
    {
        _postgresFixture = postgresFixture;
    }

    [Fact]
    public async Task DatabaseMigrate_FromZero_AppliesMigrations()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention()
            .Options;

        await using var db = new AppDbContext(options);
        var before = await db.Database.GetAppliedMigrationsAsync();
        Assert.Empty(before);

        await db.Database.MigrateAsync();

        var after = await db.Database.GetAppliedMigrationsAsync();
        var knownMigrations = db.Database.GetMigrations().ToArray();
        Assert.NotEmpty(after);
        Assert.NotEmpty(knownMigrations);
        Assert.All(knownMigrations, migrationId => Assert.Contains(migrationId, after));
    }

    [Fact]
    public async Task AppStart_FreshDatabase_RunsMigrationsAndSeeding()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/config");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var appliedMigrations = await db.Database.GetAppliedMigrationsAsync();
        var knownMigrations = db.Database.GetMigrations().ToArray();
        Assert.NotEmpty(appliedMigrations);
        Assert.NotEmpty(knownMigrations);
        Assert.All(knownMigrations, migrationId => Assert.Contains(migrationId, appliedMigrations));

        Assert.True(await db.Themes.AnyAsync(), "Expected seeded themes.");
        Assert.True(await db.ThemePackages.AnyAsync(), "Expected seeded theme packages.");
    }

    [Fact]
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

        Assert.NotEmpty(appliedMigrations);
        Assert.NotEmpty(knownMigrations);
        Assert.All(knownMigrations, migrationId => Assert.Contains(migrationId, appliedMigrations));
    }

    [Fact]
    public async Task MonetizationSmoke_ThemeAccess_HidesPrivateAndShowsPublicLocked()
    {
        var connectionString = await _postgresFixture.CreateFreshDatabaseConnectionStringAsync();
        await using var factory = new IntegrationDbWebApplicationFactory(connectionString);
        using var client = factory.CreateClient();

        var token = await SeedThemeAccessScenarioAsync(factory.Services);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await client.GetAsync("/api/organizer/me/theme-access");
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(
            response.StatusCode == HttpStatusCode.OK,
            $"Theme access failed with status {(int)response.StatusCode}: {body}");
        var payload = JsonSerializer.Deserialize<ThemeAccessResponse>(body, JsonOptions);
        Assert.NotNull(payload);

        Assert.Contains("basic", payload!.GrantedThemeIds);
        Assert.DoesNotContain(payload.VisibleLockedThemes, x => x.ThemeId == "cyberpunk");
        Assert.Contains(payload.VisibleLockedThemes, x => x.ThemeId == "sakura");
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
