using CherryPlayServer.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace CherryPlayServer.Tests.IntegrationDb;

public sealed class IntegrationDbWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _connectionString;

    public IntegrationDbWebApplicationFactory(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        if (string.IsNullOrWhiteSpace(builder.Database) || !builder.Database.StartsWith("cherryplay_it_", StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"Unsafe IntegrationDb connection target '{builder.Database}'. " +
                "Integration tests must run only against ephemeral databases with prefix 'cherryplay_it_'.");
        }

        _connectionString = connectionString;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        // UseSetting applies before Program.cs reads configuration during service registration.
        builder.UseSetting("UseInMemoryStorage", "false");
        builder.UseSetting("Database:AutoMigrateOnStartup", "true");
        builder.UseSetting("ConnectionStrings:DefaultConnection", _connectionString);
        builder.UseSetting("JWT_SECRET_KEY", "integration-tests-secret-key-minimum-32-characters");
        builder.UseSetting("Auth:OAuthEnabled", "false");
    }

    public async Task WaitUntilDatabaseReachableAsync(CancellationToken cancellationToken = default)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.CanConnectAsync(cancellationToken);
    }
}
