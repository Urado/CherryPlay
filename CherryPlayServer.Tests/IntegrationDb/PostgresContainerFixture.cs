using Npgsql;
using Testcontainers.PostgreSql;

namespace CherryPlayServer.Tests.IntegrationDb;

public sealed class PostgresContainerFixture
{
    public const string AdminConnectionStringEnvVar =
        "CHERRYPLAY_INTEGRATION_DB_ADMIN_CONNECTION_STRING";

    public const string AllowRemoteAdminEnvVar =
        "CHERRYPLAY_INTEGRATION_DB_ALLOW_REMOTE_ADMIN";

    private readonly PostgreSqlContainer? _container;
    private readonly string? _adminConnectionStringOverride;

    public PostgresContainerFixture()
    {
        _adminConnectionStringOverride = Environment.GetEnvironmentVariable(AdminConnectionStringEnvVar);
        if (string.IsNullOrWhiteSpace(_adminConnectionStringOverride))
        {
            _container = new PostgreSqlBuilder("postgres:16-alpine")
                .WithDatabase("postgres")
                .WithUsername("postgres")
                .WithPassword("postgres")
                .Build();
        }
        else
        {
            ValidateAdminConnectionStringOverride(_adminConnectionStringOverride);
        }
    }

    private static void ValidateAdminConnectionStringOverride(string connectionString)
    {
        var allowRemote = string.Equals(
            Environment.GetEnvironmentVariable(AllowRemoteAdminEnvVar),
            "true",
            StringComparison.OrdinalIgnoreCase);
        if (allowRemote)
        {
            return;
        }

        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var host = builder.Host?.Trim() ?? string.Empty;
        if (IsAllowedLocalAdminHost(host))
        {
            return;
        }

        throw new InvalidOperationException(
            $"Unsafe IntegrationDb admin connection host '{host}'. " +
            $"Admin connection override ({AdminConnectionStringEnvVar}) must target localhost, 127.0.0.1, or host.docker.internal. " +
            $"Set {AllowRemoteAdminEnvVar}=true to opt in to remote admin databases.");
    }

    private static bool IsAllowedLocalAdminHost(string host) =>
        host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
        || host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase)
        || host.Equals("host.docker.internal", StringComparison.OrdinalIgnoreCase);

    public string AdminConnectionString =>
        _adminConnectionStringOverride ?? _container!.GetConnectionString();

    public async Task InitializeAsync()
    {
        if (_container is not null)
        {
            await _container.StartAsync();
            return;
        }

        await using var connection = new NpgsqlConnection(AdminConnectionString);
        await connection.OpenAsync();
    }

    public async Task DisposeAsync()
    {
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    public async Task<string> CreateFreshDatabaseConnectionStringAsync()
    {
        var databaseName = $"cherryplay_it_{Guid.NewGuid():N}";
        await using var connection = new NpgsqlConnection(AdminConnectionString);
        await connection.OpenAsync();

        await using (var createCommand = connection.CreateCommand())
        {
            createCommand.CommandText = $"CREATE DATABASE \"{databaseName}\"";
            await createCommand.ExecuteNonQueryAsync();
        }

        var builder = new NpgsqlConnectionStringBuilder(AdminConnectionString)
        {
            Database = databaseName
        };

        return builder.ConnectionString;
    }
}
