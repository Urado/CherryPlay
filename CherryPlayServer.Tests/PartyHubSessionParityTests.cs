using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Hubs;
using CherryPlayServer.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class PartyHubSessionParityTests
{
    private SessionParityWebApplicationFactory _factory = null!;
    private IServiceScope _scope = null!;
    private PartyHub _hub = null!;
    private IOrganizerSessionRepository _sessions = null!;
    private IStreamingRepository _streaming = null!;
    private IJwtService _jwt = null!;
    private SessionParityHubClients _clients = null!;
    private SessionParityGroupManager _groups = null!;
    private DefaultHttpContext _httpContext = null!;
    private Guid _organizerId;
    private Guid _sessionId;
    private Guid _partyId;
    private string _token = string.Empty;

    [SetUp]
    public async Task SetUp()
    {
        _factory = new SessionParityWebApplicationFactory();
        _scope = _factory.Services.CreateScope();
        var services = _scope.ServiceProvider;
        _sessions = services.GetRequiredService<IOrganizerSessionRepository>();
        _streaming = services.GetRequiredService<IStreamingRepository>();
        _jwt = services.GetRequiredService<IJwtService>();
        _organizerId = Guid.NewGuid();
        _sessionId = Guid.NewGuid();
        _partyId = Guid.NewGuid();
        await _sessions.AddAsync(new OrganizerSession { Id = _sessionId, OrganizerId = _organizerId });
        await services.GetRequiredService<IPartyRepository>().AddAsync(new Party
        {
            Id = _partyId,
            OrganizerId = _organizerId,
            ShortCode = $"{Guid.NewGuid():N}"[..10],
            Name = "Session parity"
        });
        _token = await _jwt.GenerateTokenAsync(_organizerId, "Organizer", _sessionId, "organizer");
        _clients = new SessionParityHubClients();
        _groups = new SessionParityGroupManager();
        _httpContext = new DefaultHttpContext();
        _hub = ActivatorUtilities.CreateInstance<PartyHub>(services, new SessionParityHubContext(_clients, _groups));
        _hub.Context = new SessionParityHubCallerContext(_httpContext);
        _hub.Clients = _clients;
        _hub.Groups = _groups;
    }

    [TearDown]
    public async Task TearDown()
    {
        _hub.Dispose();
        _scope.Dispose();
        await _factory.DisposeAsync();
    }

    [Test]
    public async Task OrganizerWrite_AfterRevocation_RejectsSameConnectionWithoutMutationOrRelay(
        [Values("UpdatePlaybackPosition", "UpdateFullState", "NotifyStateChanged", "NotifyPlaylistChanged", "StartSession", "EndSession", "ResetPlaybackState")] string method,
        [Values] bool revokeAll,
        [Values("query", "header")] string source)
    {
        SetContextToken(_token, source);
        await _hub.JoinPartyAsOrganizer(_partyId.ToString(), string.Empty);
        await _hub.StartSession(_partyId.ToString());
        Assert.That(_clients.CallerProxy.Messages, Is.Empty);
        Assert.That(_clients.GroupProxy.Messages.Any(message => message.Method == "OnSessionStarted"), Is.True);
        Assert.That(_hub.Context.Items["OrganizerId"], Is.EqualTo(_organizerId));
        var before = JsonSerializer.Serialize(await _streaming.GetSessionStateAsync(_partyId));
        await RevokeAsync(revokeAll);
        Assert.That((await _jwt.ValidateTokenAsync(_token)).IsValid, Is.True);
        ClearMessages();

        await InvokeWriteAsync(method);

        AssertAuthenticationError("Authentication required");
        Assert.That(JsonSerializer.Serialize(await _streaming.GetSessionStateAsync(_partyId)), Is.EqualTo(before));
        Assert.That(_groups.AddCount, Is.EqualTo(1));
    }

    [Test]
    public async Task OrganizerJoin_ParameterToken_AfterRevocation_RejectsSameConnection(
        [Values] bool revokeAll,
        [Values] bool revokedContextToken)
    {
        await _hub.JoinPartyAsOrganizer(_partyId.ToString(), _token);
        Assert.That(_clients.CallerProxy.Messages, Is.Empty);
        Assert.That(_groups.AddCount, Is.EqualTo(1));
        await RevokeAsync(revokeAll);
        if (revokedContextToken)
        {
            SetContextToken(_token, "query");
        }
        Assert.That((await _jwt.ValidateTokenAsync(_token)).IsValid, Is.True);
        ClearMessages();

        await _hub.JoinPartyAsOrganizer(_partyId.ToString(), _token);

        AssertAuthenticationError("Authentication token is required");
        Assert.That(_groups.AddCount, Is.EqualTo(1));
        Assert.That(await _streaming.GetSessionStateAsync(_partyId), Is.Null);
    }

    [Test]
    public async Task OrganizerAuth_InvalidSessionOrJwt_RejectsWithoutMutationOrRelay(
        [Values("missing-session-id", "missing-organizer-id", "missing-session", "mismatched-organizer", "expired", "invalid-signature")] string failure,
        [Values("query", "header", "parameter")] string source)
    {
        var token = CreateToken(failure);
        if (source != "parameter")
        {
            SetContextToken(token, source);
        }
        else
        {
            await _hub.JoinPartyAsOrganizer(_partyId.ToString(), token);
        }
        if (source != "parameter")
        {
            await _hub.StartSession(_partyId.ToString());
        }

        AssertAuthenticationError(source == "parameter" ? "Authentication token is required" : "Authentication required");
        Assert.That(_groups.AddCount, Is.Zero);
        Assert.That(_hub.Context.Items.ContainsKey("OrganizerId"), Is.False);
        Assert.That(await _streaming.GetSessionStateAsync(_partyId), Is.Null);
    }

    private string CreateToken(string failure)
    {
        List<Claim> claims = [];
        if (failure != "missing-organizer-id")
        {
            claims.Add(new Claim("organizerId", (failure == "mismatched-organizer" ? Guid.NewGuid() : _organizerId).ToString()));
        }
        if (failure != "missing-session-id")
        {
            claims.Add(new Claim("sessionId", (failure == "missing-session" ? Guid.NewGuid() : _sessionId).ToString()));
        }
        var secret = failure == "invalid-signature" ? "different-signing-key-with-at-least-32characters" : SessionParityWebApplicationFactory.JwtSecret;
        var token = new JwtSecurityToken(
            issuer: "CherryPlayServer",
            audience: "CherryPlayClient",
            claims: claims,
            expires: failure == "expired" ? DateTime.UtcNow.AddHours(-1) : DateTime.UtcNow.AddHours(1),
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private void SetContextToken(string token, string source)
    {
        if (source == "query")
        {
            _httpContext.Request.QueryString = new QueryString($"?access_token={token}");
        }
        else
        {
            _httpContext.Request.Headers.Authorization = $"Bearer {token}";
        }
    }

    private Task InvokeWriteAsync(string method) => method switch
    {
        "UpdatePlaybackPosition" => _hub.UpdatePlaybackPosition(_partyId.ToString(), "track", 42),
        "UpdateFullState" => _hub.UpdateFullState(_partyId.ToString(), new PlaybackStateDto { Position = 42 }),
        "NotifyStateChanged" => _hub.NotifyStateChanged(_partyId.ToString()),
        "NotifyPlaylistChanged" => _hub.NotifyPlaylistChanged(_partyId.ToString()),
        "StartSession" => _hub.StartSession(_partyId.ToString()),
        "EndSession" => _hub.EndSession(_partyId.ToString()),
        "ResetPlaybackState" => _hub.ResetPlaybackState(_partyId.ToString()),
        _ => throw new ArgumentOutOfRangeException(nameof(method))
    };

    private Task RevokeAsync(bool revokeAll) => revokeAll
        ? _sessions.RemoveAllByOrganizerIdAsync(_organizerId)
        : _sessions.RemoveAsync(_sessionId);

    private void ClearMessages()
    {
        _clients.CallerProxy.Messages.Clear();
        _clients.GroupProxy.Messages.Clear();
    }

    private void AssertAuthenticationError(string error)
    {
        Assert.That(_clients.CallerProxy.Messages, Has.Count.EqualTo(1));
        Assert.That(_clients.CallerProxy.Messages[0].Method, Is.EqualTo("Error"));
        Assert.That(_clients.CallerProxy.Messages[0].Arguments, Is.EqualTo(new object[] { error }));
        Assert.That(_clients.GroupProxy.Messages, Is.Empty);
    }
}
