using Npgsql;

namespace CherryPlayServer.Tests;

[TestFixture]
[NonParallelizable]
public sealed class ContainerRetentionRestartIntegrationTests
{
    private static readonly Guid OrganizerId = Guid.Parse("f5000000-0000-4000-8000-000000000001");
    private static readonly Guid EmailAccountId = Guid.Parse("f5000000-0000-4000-8000-000000000002");
    private static readonly Guid StaleUsedTokenId = Guid.Parse("f5000000-0000-4000-8000-000000000003");
    private static readonly Guid StaleExpiredTokenId = Guid.Parse("f5000000-0000-4000-8000-000000000004");
    private static readonly Guid FreshUsedTokenId = Guid.Parse("f5000000-0000-4000-8000-000000000005");
    private static readonly Guid ActiveTokenId = Guid.Parse("f5000000-0000-4000-8000-000000000006");
    private const string Email = "container-retention-restart-fixture@example.invalid";

    [Test]
    [Category("ContainerRetentionPrepare")]
    public async Task ContainerRetentionPrepare()
    {
        await using var connection = await OpenSharedRunDatabaseAsync();
        var now = DateTime.UtcNow;
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO organizers (id, name, role, created_at, is_deleted)
            VALUES (@organizerId, 'Container retention fixture', 'organizer', @now, FALSE)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_deleted = FALSE;
            """;
        command.Parameters.AddWithValue("organizerId", OrganizerId);
        command.Parameters.AddWithValue("now", now);
        await command.ExecuteNonQueryAsync();

        await using (var account = connection.CreateCommand())
        {
            account.CommandText = """
                INSERT INTO email_accounts (id, organizer_id, email, password_hash, created_at)
                VALUES (@accountId, @organizerId, @email, 'fixture-hash', @now)
                ON CONFLICT (id) DO UPDATE SET organizer_id = EXCLUDED.organizer_id, email = EXCLUDED.email, password_hash = EXCLUDED.password_hash;
                """;
            account.Parameters.AddWithValue("accountId", EmailAccountId);
            account.Parameters.AddWithValue("organizerId", OrganizerId);
            account.Parameters.AddWithValue("email", Email);
            account.Parameters.AddWithValue("now", now);
            await account.ExecuteNonQueryAsync();
        }

        await using var tokens = connection.CreateCommand();
        tokens.CommandText = """
            INSERT INTO password_reset_tokens (id, email_account_id, token_hash, expires_at, used_at, created_at)
            VALUES
                (@staleUsedId, @accountId, 'container-retention-stale-used', @oldExpiry, @oldUsed, @oldCreated),
                (@staleExpiredId, @accountId, 'container-retention-stale-expired', @oldExpiry, NULL, @oldCreated),
                (@freshUsedId, @accountId, 'container-retention-fresh-used', @freshExpiry, @freshUsed, @freshCreated),
                (@activeId, @accountId, 'container-retention-active', @activeExpiry, NULL, @now)
            ON CONFLICT (id) DO UPDATE SET
                email_account_id = EXCLUDED.email_account_id,
                token_hash = EXCLUDED.token_hash,
                expires_at = EXCLUDED.expires_at,
                used_at = EXCLUDED.used_at,
                created_at = EXCLUDED.created_at;
            """;
        tokens.Parameters.AddWithValue("staleUsedId", StaleUsedTokenId);
        tokens.Parameters.AddWithValue("staleExpiredId", StaleExpiredTokenId);
        tokens.Parameters.AddWithValue("freshUsedId", FreshUsedTokenId);
        tokens.Parameters.AddWithValue("activeId", ActiveTokenId);
        tokens.Parameters.AddWithValue("accountId", EmailAccountId);
        tokens.Parameters.AddWithValue("oldExpiry", now.AddDays(-32));
        tokens.Parameters.AddWithValue("oldUsed", now.AddDays(-31));
        tokens.Parameters.AddWithValue("oldCreated", now.AddDays(-40));
        tokens.Parameters.AddWithValue("freshExpiry", now.AddDays(-10));
        tokens.Parameters.AddWithValue("freshUsed", now.AddDays(-5));
        tokens.Parameters.AddWithValue("freshCreated", now.AddDays(-10));
        tokens.Parameters.AddWithValue("activeExpiry", now.AddHours(1));
        tokens.Parameters.AddWithValue("now", now);
        await tokens.ExecuteNonQueryAsync();
    }

    [Test]
    [Category("ContainerRetentionVerify")]
    public async Task ContainerRetentionVerify()
    {
        await using var connection = await OpenSharedRunDatabaseAsync();
        var deadline = DateTime.UtcNow.AddSeconds(30);
        var staleRowsRemain = true;
        while (DateTime.UtcNow < deadline)
        {
            staleRowsRemain = await AnyFixtureTokenAsync(connection, StaleUsedTokenId, StaleExpiredTokenId);
            if (!staleRowsRemain)
            {
                break;
            }

            await Task.Delay(100);
        }

        var freshUsedRemains = await FixtureTokenExistsAsync(connection, FreshUsedTokenId);
        var activeRemains = await FixtureTokenExistsAsync(connection, ActiveTokenId);
        await CleanupFixtureAsync(connection);

        Assert.That(staleRowsRemain, Is.False, "The restarted backend did not remove stale fixture reset tokens.");
        Assert.That(freshUsedRemains, Is.True, "The restarted backend removed a fresh used reset token.");
        Assert.That(activeRemains, Is.True, "The restarted backend removed an active reset token.");
    }

    private static async Task<NpgsqlConnection> OpenSharedRunDatabaseAsync()
    {
        var connectionString = Environment.GetEnvironmentVariable("CHERRYPLAY_INTEGRATION_DB_ADMIN_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("CHERRYPLAY_INTEGRATION_DB_ADMIN_CONNECTION_STRING is required.");
        }

        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        if (!string.Equals(builder.Database, "cherryplay_it_run", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Container retention restart tests require the shared cherryplay_it_run database.");
        }

        var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        return connection;
    }

    private static async Task<bool> AnyFixtureTokenAsync(NpgsqlConnection connection, Guid firstId, Guid secondId)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT EXISTS (SELECT 1 FROM password_reset_tokens WHERE id = @firstId OR id = @secondId)";
        command.Parameters.AddWithValue("firstId", firstId);
        command.Parameters.AddWithValue("secondId", secondId);
        return (bool)(await command.ExecuteScalarAsync())!;
    }

    private static async Task<bool> FixtureTokenExistsAsync(NpgsqlConnection connection, Guid tokenId)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT EXISTS (SELECT 1 FROM password_reset_tokens WHERE id = @id)";
        command.Parameters.AddWithValue("id", tokenId);
        return (bool)(await command.ExecuteScalarAsync())!;
    }

    private static async Task CleanupFixtureAsync(NpgsqlConnection connection)
    {
        await using (var tokens = connection.CreateCommand())
        {
            tokens.CommandText = "DELETE FROM password_reset_tokens WHERE id = ANY(@ids)";
            tokens.Parameters.AddWithValue("ids", new[] { StaleUsedTokenId, StaleExpiredTokenId, FreshUsedTokenId, ActiveTokenId });
            await tokens.ExecuteNonQueryAsync();
        }

        await using (var account = connection.CreateCommand())
        {
            account.CommandText = "DELETE FROM email_accounts WHERE id = @id";
            account.Parameters.AddWithValue("id", EmailAccountId);
            await account.ExecuteNonQueryAsync();
        }

        await using var organizer = connection.CreateCommand();
        organizer.CommandText = "DELETE FROM organizers WHERE id = @id";
        organizer.Parameters.AddWithValue("id", OrganizerId);
        await organizer.ExecuteNonQueryAsync();
    }
}
