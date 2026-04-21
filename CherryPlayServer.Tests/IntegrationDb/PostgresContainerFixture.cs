using Npgsql;
using Testcontainers.PostgreSql;

namespace CherryPlayServer.Tests.IntegrationDb;

public sealed class PostgresContainerFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:16-alpine")
        .WithDatabase("postgres")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    public string AdminConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync();
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
