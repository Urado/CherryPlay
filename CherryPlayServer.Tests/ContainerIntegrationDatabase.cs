using Npgsql;

namespace CherryPlayServer.Tests;

internal sealed class ContainerIntegrationDatabase : IAsyncDisposable
{
    private readonly string _adminConnectionString;
    private readonly string _databaseName;

    private ContainerIntegrationDatabase(string adminConnectionString, string databaseName, string connectionString)
    {
        _adminConnectionString = adminConnectionString;
        _databaseName = databaseName;
        ConnectionString = connectionString;
    }

    public string ConnectionString { get; }

    public static async Task<ContainerIntegrationDatabase> CreateAsync()
    {
        var adminConnectionString = Environment.GetEnvironmentVariable("CHERRYPLAY_INTEGRATION_DB_ADMIN_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(adminConnectionString))
        {
            throw new InvalidOperationException("CHERRYPLAY_INTEGRATION_DB_ADMIN_CONNECTION_STRING is required.");
        }

        var databaseName = $"cherryplay_it_{Guid.NewGuid():N}";
        await using var adminConnection = new NpgsqlConnection(adminConnectionString);
        await adminConnection.OpenAsync();
        await using (var command = adminConnection.CreateCommand())
        {
            command.CommandText = $"CREATE DATABASE \"{databaseName}\"";
            await command.ExecuteNonQueryAsync();
        }

        var builder = new NpgsqlConnectionStringBuilder(adminConnectionString) { Database = databaseName };
        return new ContainerIntegrationDatabase(adminConnectionString, databaseName, builder.ConnectionString);
    }

    public async ValueTask DisposeAsync()
    {
        await using var adminConnection = new NpgsqlConnection(_adminConnectionString);
        await adminConnection.OpenAsync();
        await using var terminate = adminConnection.CreateCommand();
        terminate.CommandText = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = @databaseName AND pid <> pg_backend_pid()";
        terminate.Parameters.AddWithValue("databaseName", _databaseName);
        await terminate.ExecuteNonQueryAsync();
        await using var drop = adminConnection.CreateCommand();
        drop.CommandText = $"DROP DATABASE IF EXISTS \"{_databaseName}\"";
        await drop.ExecuteNonQueryAsync();
    }
}
