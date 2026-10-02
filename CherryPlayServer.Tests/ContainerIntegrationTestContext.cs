using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

namespace CherryPlayServer.Tests;

public sealed class ContainerIntegrationTestContext : IAsyncDisposable
{
    private const string AdminConnectionStringVariable = "CHERRYPLAY_INTEGRATION_DB_ADMIN_CONNECTION_STRING";
    private const string ApiBaseUrlVariable = "CHERRYPLAY_API_BASE_URL";
    private const string JwtSecretVariable = "CHERRYPLAY_INTEGRATION_JWT_SECRET_KEY";
    private readonly NpgsqlConnection _connection;
    private readonly bool _preserveSeedData;
    private readonly List<Guid> _organizerIds = [];
    private readonly Dictionary<Guid, string> _shortCodes = [];
    private readonly List<(string Trigger, string Function)> _writeFailureTriggers = [];

    private ContainerIntegrationTestContext(NpgsqlConnection connection, Uri baseAddress, bool preserveSeedData = false)
    {
        _connection = connection;
        _preserveSeedData = preserveSeedData;
        Client = new HttpClient { BaseAddress = baseAddress };
    }

    public HttpClient Client { get; }
    public Guid OrganizerId { get; private set; }
    public Guid SessionId { get; private set; }
    public string Token { get; private set; } = string.Empty;
    private string JwtSecret { get; set; } = string.Empty;

    public static async Task<ContainerIntegrationTestContext> CreateAsync()
    {
        var connectionString = RequiredEnvironmentVariable(AdminConnectionStringVariable);
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        if (string.IsNullOrWhiteSpace(builder.Database)
            || !builder.Database.StartsWith("cherryplay_it_", StringComparison.Ordinal))
        {
            throw new InvalidOperationException($"{AdminConnectionStringVariable} must target a dedicated cherryplay_it_* database shared with the backend container.");
        }

        var baseAddress = new Uri(RequiredEnvironmentVariable(ApiBaseUrlVariable));
        var secret = RequiredEnvironmentVariable(JwtSecretVariable);
        if (secret.Length < 32)
        {
            throw new InvalidOperationException($"{JwtSecretVariable} must contain at least 32 characters.");
        }

        var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        var context = new ContainerIntegrationTestContext(connection, baseAddress);
        await context.SeedOrganizerAsync(secret);
        return context;
    }

    public static async Task<ContainerIntegrationTestContext> CreateRestartContextAsync(Guid organizerId, Guid sessionId)
    {
        var connectionString = RequiredEnvironmentVariable(AdminConnectionStringVariable);
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        if (string.IsNullOrWhiteSpace(builder.Database) || !builder.Database.StartsWith("cherryplay_it_", StringComparison.Ordinal))
        {
            throw new InvalidOperationException($"{AdminConnectionStringVariable} must target a dedicated cherryplay_it_* database shared with the backend container.");
        }

        var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        var context = new ContainerIntegrationTestContext(connection, new Uri(RequiredEnvironmentVariable(ApiBaseUrlVariable)), true);
        var secret = RequiredEnvironmentVariable(JwtSecretVariable);
        if (secret.Length < 32)
        {
            throw new InvalidOperationException($"{JwtSecretVariable} must contain at least 32 characters.");
        }

        await context.SeedOrganizerAsync(secret, organizerId, sessionId);
        return context;
    }

    public async Task<Guid> CreatePartyAsync(string? name = null, string? lifecycleState = "ready", bool listed = true, Guid? organizerId = null)
    {
        var id = Guid.NewGuid();
        var shortCode = $"it{Guid.NewGuid():N}"[..10];
        await using var command = _connection.CreateCommand();
        command.CommandText = "INSERT INTO parties (id, organizer_id, name, short_code, party_theme_id, is_listed_in_catalog, created_at, is_deleted, party_lifecycle_state) VALUES (@id, @organizer, @name, @code, 'basic', @listed, now(), false, @state)";
        command.Parameters.AddWithValue("id", id);
        command.Parameters.AddWithValue("organizer", organizerId ?? OrganizerId);
        command.Parameters.AddWithValue("name", name ?? $"Container test {id:N}");
        command.Parameters.AddWithValue("code", shortCode);
        command.Parameters.AddWithValue("listed", listed);
        command.Parameters.AddWithValue("state", lifecycleState switch { "draft" => 1, "completed" => 3, _ => 2 });
        await command.ExecuteNonQueryAsync();
        _shortCodes[id] = shortCode;
        return id;
    }

    public async Task AddPlaylistAsync(Guid partyId, string json, int totalTracks = 1, int totalDuration = 90)
    {
        await using var command = _connection.CreateCommand();
        command.CommandText = "INSERT INTO party_playlists (party_id, items, total_duration, total_tracks) VALUES (@id, @items::jsonb, @duration, @tracks) ON CONFLICT (party_id) DO UPDATE SET items = EXCLUDED.items, total_duration = EXCLUDED.total_duration, total_tracks = EXCLUDED.total_tracks";
        command.Parameters.AddWithValue("id", partyId);
        command.Parameters.AddWithValue("items", json);
        command.Parameters.AddWithValue("duration", totalDuration);
        command.Parameters.AddWithValue("tracks", totalTracks);
        await command.ExecuteNonQueryAsync();
    }

    public async Task CreateRestartPartyAsync(Guid partyId, string shortCode)
    {
        await using var command = _connection.CreateCommand();
        command.CommandText = "INSERT INTO parties (id, organizer_id, name, short_code, party_theme_id, is_listed_in_catalog, created_at, is_deleted, party_lifecycle_state) VALUES (@id, @organizer, 'Container restart fixture', @code, 'basic', true, now(), false, 2) ON CONFLICT (id) DO UPDATE SET organizer_id = EXCLUDED.organizer_id, name = EXCLUDED.name, short_code = EXCLUDED.short_code, party_theme_id = EXCLUDED.party_theme_id, is_listed_in_catalog = true, is_deleted = false, party_lifecycle_state = 2";
        command.Parameters.AddWithValue("id", partyId);
        command.Parameters.AddWithValue("organizer", OrganizerId);
        command.Parameters.AddWithValue("code", shortCode);
        await command.ExecuteNonQueryAsync();
        _shortCodes[partyId] = shortCode;
    }

    public async Task AddSessionStateAsync(Guid partyId, string currentTrackId = "track-a", double position = 12.5, bool active = true, string mode = "preparation")
    {
        await using var command = _connection.CreateCommand();
        command.CommandText = "INSERT INTO session_states (party_id, is_active, current_track_id, status, position, duration, volume, mode, played_track_ids, disabled_track_ids, disabled_group_ids, last_updated_at) VALUES (@id, @active, @track, 'playing', @position, 90, 0.8, @mode, '[\"track-a\"]'::jsonb, '[\"track-b\"]'::jsonb, '[\"group-a\"]'::jsonb, now()) ON CONFLICT (party_id) DO UPDATE SET is_active = EXCLUDED.is_active, current_track_id = EXCLUDED.current_track_id, status = EXCLUDED.status, position = EXCLUDED.position, duration = EXCLUDED.duration, volume = EXCLUDED.volume, mode = EXCLUDED.mode, played_track_ids = EXCLUDED.played_track_ids, disabled_track_ids = EXCLUDED.disabled_track_ids, disabled_group_ids = EXCLUDED.disabled_group_ids, last_updated_at = EXCLUDED.last_updated_at";
        command.Parameters.AddWithValue("id", partyId);
        command.Parameters.AddWithValue("active", active);
        command.Parameters.AddWithValue("track", currentTrackId);
        command.Parameters.AddWithValue("position", position);
        command.Parameters.AddWithValue("mode", mode);
        await command.ExecuteNonQueryAsync();
    }

    public async Task<Guid> AddEmailAccountAsync(string password)
    {
        var emailAccountId = Guid.NewGuid();
        await using var command = _connection.CreateCommand();
        command.CommandText = "INSERT INTO email_accounts (id, organizer_id, email, password_hash, created_at) VALUES (@id, @organizer, @email, @hash, now())";
        command.Parameters.AddWithValue("id", emailAccountId);
        command.Parameters.AddWithValue("organizer", OrganizerId);
        command.Parameters.AddWithValue("email", $"container-{OrganizerId:N}@example.test");
        command.Parameters.AddWithValue("hash", BCrypt.Net.BCrypt.HashPassword(password));
        await command.ExecuteNonQueryAsync();
        return emailAccountId;
    }

    public async Task<string> CreatePasswordResetTokenAsync(Guid emailAccountId)
    {
        var rawToken = CherryPlayServer.Core.Services.PasswordResetTokenHelper.GenerateRawToken();
        var tokenHash = CherryPlayServer.Core.Services.PasswordResetTokenHelper.HashToken(rawToken);
        await using var command = _connection.CreateCommand();
        command.CommandText = "INSERT INTO password_reset_tokens (id, email_account_id, token_hash, expires_at, used_at, created_at) VALUES (@id, @email, @hash, now() + interval '1 hour', null, now())";
        command.Parameters.AddWithValue("id", Guid.NewGuid());
        command.Parameters.AddWithValue("email", emailAccountId);
        command.Parameters.AddWithValue("hash", tokenHash);
        await command.ExecuteNonQueryAsync();
        return rawToken;
    }

    public async Task<string> CreateAdditionalSessionTokenAsync()
    {
        var sessionId = Guid.NewGuid();
        await using var command = _connection.CreateCommand();
        command.CommandText = "INSERT INTO organizer_sessions (id, organizer_id, created_at) VALUES (@id, @organizer, now())";
        command.Parameters.AddWithValue("id", sessionId);
        command.Parameters.AddWithValue("organizer", OrganizerId);
        await command.ExecuteNonQueryAsync();
        return CreateToken("organizer", DateTime.UtcNow.AddHours(2), sessionId);
    }

    public async Task InstallSessionWriteFailureAsync(Guid partyId)
    {
        var suffix = Guid.NewGuid().ToString("N");
        var functionName = $"it_fail_session_{suffix}";
        var triggerName = $"it_fail_session_{suffix}";
        await using var command = _connection.CreateCommand();
        command.CommandText = $"CREATE FUNCTION \"{functionName}\"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.party_id = '{partyId:D}' THEN RAISE EXCEPTION 'integration test forced persistence failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER \"{triggerName}\" BEFORE INSERT OR UPDATE ON session_states FOR EACH ROW EXECUTE FUNCTION \"{functionName}\"()";
        await command.ExecuteNonQueryAsync();
        _writeFailureTriggers.Add((triggerName, functionName));
    }

    public async Task<string> CreateDesktopCodeAsync()
    {
        var rawCode = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawCode))).ToLowerInvariant();
        await using var command = _connection.CreateCommand();
        command.CommandText = "INSERT INTO desktop_auth_codes (id, organizer_id, token_hash, expires_at, used_at, created_at) VALUES (@id, @organizer, @hash, now() + interval '3 minutes', null, now())";
        command.Parameters.AddWithValue("id", Guid.NewGuid());
        command.Parameters.AddWithValue("organizer", OrganizerId);
        command.Parameters.AddWithValue("hash", tokenHash);
        await command.ExecuteNonQueryAsync();
        return rawCode;
    }

    public async Task<string?> GetPartyNameAsync(Guid partyId)
    {
        await using var command = _connection.CreateCommand();
        command.CommandText = "SELECT name FROM parties WHERE id = @id";
        command.Parameters.AddWithValue("id", partyId);
        return await command.ExecuteScalarAsync() as string;
    }

    public async Task<bool> PartyExistsAsync(Guid partyId)
    {
        await using var command = _connection.CreateCommand();
        command.CommandText = "SELECT EXISTS (SELECT 1 FROM parties WHERE id = @id)";
        command.Parameters.AddWithValue("id", partyId);
        return (bool)(await command.ExecuteScalarAsync())!;
    }

    public async Task<bool> SessionStateExistsAsync(Guid partyId)
    {
        await using var command = _connection.CreateCommand();
        command.CommandText = "SELECT EXISTS (SELECT 1 FROM session_states WHERE party_id = @id)";
        command.Parameters.AddWithValue("id", partyId);
        return (bool)(await command.ExecuteScalarAsync())!;
    }

    public HttpRequestMessage Authenticated(HttpMethod method, string path, HttpContent? content = null, string? token = null)
    {
        var request = new HttpRequestMessage(method, path) { Content = content };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token ?? Token);
        return request;
    }

    public string ShortCodeFor(Guid partyId)
    {
        return _shortCodes[partyId];
    }

    public static StringContent Json(string value) => new(value, Encoding.UTF8, "application/json");

    public string TokenWithRole(string role) => CreateToken(role, DateTime.UtcNow.AddHours(2));

    public string TokenWithWrongKey()
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("wrong-integration-secret-key-with-32-chars"));
        var token = new JwtSecurityToken(
            issuer: "CherryPlayServer",
            audience: "CherryPlayClient",
            claims: [new Claim("organizerId", OrganizerId.ToString()), new Claim("name", "Wrong signature"), new Claim("sessionId", SessionId.ToString()), new Claim("role", "organizer"), new Claim(JwtRegisteredClaimNames.Jti, SessionId.ToString())],
            expires: DateTime.UtcNow.AddHours(2),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string ExpiredToken() => CreateToken("organizer", DateTime.UtcNow.AddMinutes(-5));

    public async Task<Guid> CreateAdditionalOrganizerAsync()
    {
        var organizerId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        _organizerIds.Add(organizerId);
        await using (var command = _connection.CreateCommand())
        {
            command.CommandText = "INSERT INTO organizers (id, name, role, created_at, is_deleted) VALUES (@id, @name, 'organizer', now(), false)";
            command.Parameters.AddWithValue("id", organizerId);
            command.Parameters.AddWithValue("name", $"Container organizer {organizerId:N}");
            await command.ExecuteNonQueryAsync();
        }

        await using (var command = _connection.CreateCommand())
        {
            command.CommandText = "INSERT INTO organizer_sessions (id, organizer_id, created_at) VALUES (@id, @organizer, now())";
            command.Parameters.AddWithValue("id", sessionId);
            command.Parameters.AddWithValue("organizer", organizerId);
            await command.ExecuteNonQueryAsync();
        }

        await SeedConsentAsync(organizerId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "1ec5bcae20671f7083e7a3a58525d7d628c7aa1b6b20c0462aea46a09ccd5f6f");
        await SeedConsentAsync(organizerId, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "c9290febb6dce3229775dba33b7a766a09f769963f82331ccd34dc274f32334d");
        return organizerId;
    }

    public async Task DeleteSessionAsync()
    {
        await using var command = _connection.CreateCommand();
        command.CommandText = "DELETE FROM organizer_sessions WHERE id = @id";
        command.Parameters.AddWithValue("id", SessionId);
        await command.ExecuteNonQueryAsync();
    }

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        if (_preserveSeedData)
        {
            await _connection.DisposeAsync();
            return;
        }

        foreach (var (trigger, function) in _writeFailureTriggers)
        {
            await using var dropCommand = _connection.CreateCommand();
            dropCommand.CommandText = $"DROP TRIGGER IF EXISTS \"{trigger}\" ON session_states; DROP FUNCTION IF EXISTS \"{function}\"()";
            await dropCommand.ExecuteNonQueryAsync();
        }

        foreach (var organizerId in _organizerIds)
        {
            await using (var deleteParties = _connection.CreateCommand())
            {
                deleteParties.CommandText = "DELETE FROM parties WHERE organizer_id = @id";
                deleteParties.Parameters.AddWithValue("id", organizerId);
                await deleteParties.ExecuteNonQueryAsync();
            }

            await using var deleteConsents = _connection.CreateCommand();
            deleteConsents.CommandText = "DELETE FROM consent_events WHERE subject_id = @id";
            deleteConsents.Parameters.AddWithValue("id", organizerId);
            await deleteConsents.ExecuteNonQueryAsync();
            await using var deleteOrganizer = _connection.CreateCommand();
            deleteOrganizer.CommandText = "DELETE FROM organizers WHERE id = @id";
            deleteOrganizer.Parameters.AddWithValue("id", organizerId);
            await deleteOrganizer.ExecuteNonQueryAsync();
        }

        await _connection.DisposeAsync();
    }

    private async Task SeedOrganizerAsync(string secret, Guid? organizerId = null, Guid? sessionId = null)
    {
        OrganizerId = organizerId ?? Guid.NewGuid();
        SessionId = sessionId ?? Guid.NewGuid();
        _organizerIds.Add(OrganizerId);
        await using (var command = _connection.CreateCommand())
        {
            command.CommandText = "INSERT INTO organizers (id, name, role, created_at, is_deleted) VALUES (@id, @name, 'organizer', now(), false) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = 'organizer', is_deleted = false";
            command.Parameters.AddWithValue("id", OrganizerId);
            command.Parameters.AddWithValue("name", $"Container organizer {OrganizerId:N}");
            await command.ExecuteNonQueryAsync();
        }

        await using (var command = _connection.CreateCommand())
        {
            command.CommandText = "INSERT INTO organizer_sessions (id, organizer_id, created_at) VALUES (@id, @organizer, now()) ON CONFLICT (id) DO UPDATE SET organizer_id = EXCLUDED.organizer_id";
            command.Parameters.AddWithValue("id", SessionId);
            command.Parameters.AddWithValue("organizer", OrganizerId);
            await command.ExecuteNonQueryAsync();
        }

        await SeedConsentAsync(OrganizerId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "1ec5bcae20671f7083e7a3a58525d7d628c7aa1b6b20c0462aea46a09ccd5f6f");
        await SeedConsentAsync(OrganizerId, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "c9290febb6dce3229775dba33b7a766a09f769963f82331ccd34dc274f32334d");
        JwtSecret = secret;
        Token = CreateToken("organizer", DateTime.UtcNow.AddHours(2));
    }

    private string CreateToken(string role, DateTime expires, Guid? sessionId = null)
    {
        var tokenSessionId = sessionId ?? SessionId;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        var token = new JwtSecurityToken(
            issuer: "CherryPlayServer",
            audience: "CherryPlayClient",
            claims:
            [
                new Claim("organizerId", OrganizerId.ToString()),
                new Claim("name", $"Container organizer {OrganizerId:N}"),
                new Claim("sessionId", tokenSessionId.ToString()),
                new Claim("role", role),
                new Claim(JwtRegisteredClaimNames.Jti, tokenSessionId.ToString())
            ],
            expires: expires,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task SeedConsentAsync(Guid organizerId, string versionId, string hash)
    {
        await using var command = _connection.CreateCommand();
        command.CommandText = "INSERT INTO consent_events (id, subject_id, legal_document_version_id, document_hash, decision, event_at) VALUES (@id, @subject, @version, @hash, 'grant', now())";
        command.Parameters.AddWithValue("id", Guid.NewGuid());
        command.Parameters.AddWithValue("subject", organizerId);
        command.Parameters.AddWithValue("version", Guid.Parse(versionId));
        command.Parameters.AddWithValue("hash", hash);
        await command.ExecuteNonQueryAsync();
    }

    private static string RequiredEnvironmentVariable(string name) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"{name} is required for container integration tests.");
}
