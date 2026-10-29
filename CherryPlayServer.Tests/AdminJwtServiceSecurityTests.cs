using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CherryPlayServer.Core.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace CherryPlayServer.Tests;

[TestFixture]
[Category("AdminPartyUnit")]
public sealed class AdminJwtServiceSecurityTests
{
    private const string ValidSecret = "admin-jwt-security-tests-secret-key-with-more-than-sixty-four-bytes-for-hs512";
    private const string ValidIssuer = "CherryPlayServer";
    private const string ValidAudience = "CherryPlayClient";

    [TestCase("not-a-jwt")]
    [TestCase("")]
    public async Task ValidateTokenAsync_MalformedToken_ReturnsInvalid(string token)
    {
        var result = await CreateService().ValidateTokenAsync(token);

        Assert.That(result.IsValid, Is.False);
    }

    [Test]
    public async Task ValidateTokenAsync_WrongSignature_ReturnsInvalid()
    {
        var token = CreateToken("different-secret-key-minimum-length-32", ValidIssuer, ValidAudience, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(10));

        var result = await CreateService().ValidateTokenAsync(token);

        Assert.That(result.IsValid, Is.False);
    }

    [Test]
    public async Task ValidateTokenAsync_CorrectSignatureWithUnsupportedAlgorithm_ReturnsInvalid()
    {
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(ValidSecret)),
            SecurityAlgorithms.HmacSha512);
        var token = new JwtSecurityToken(
            ValidIssuer,
            ValidAudience,
            CreateClaims(),
            DateTime.UtcNow.AddMinutes(-1),
            DateTime.UtcNow.AddMinutes(10),
            credentials);

        var result = await CreateService().ValidateTokenAsync(new JwtSecurityTokenHandler().WriteToken(token));

        Assert.That(result.IsValid, Is.False);
    }

    [Test]
    public async Task ValidateTokenAsync_WrongIssuer_ReturnsInvalid()
    {
        var token = CreateToken(ValidSecret, "untrusted-issuer", ValidAudience, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(10));

        var result = await CreateService().ValidateTokenAsync(token);

        Assert.That(result.IsValid, Is.False);
    }

    [Test]
    public async Task ValidateTokenAsync_WrongAudience_ReturnsInvalid()
    {
        var token = CreateToken(ValidSecret, ValidIssuer, "untrusted-audience", DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(10));

        var result = await CreateService().ValidateTokenAsync(token);

        Assert.That(result.IsValid, Is.False);
    }

    [Test]
    public async Task ValidateTokenAsync_ExpiredOutsideClockSkew_ReturnsInvalid()
    {
        var token = CreateToken(ValidSecret, ValidIssuer, ValidAudience, DateTime.UtcNow.AddMinutes(-20), DateTime.UtcNow.AddMinutes(-10));

        var result = await CreateService().ValidateTokenAsync(token);

        Assert.That(result.IsValid, Is.False);
    }

    [Test]
    public async Task ValidateTokenAsync_NotYetValidOutsideClockSkew_ReturnsInvalid()
    {
        var token = CreateToken(ValidSecret, ValidIssuer, ValidAudience, DateTime.UtcNow.AddMinutes(10), DateTime.UtcNow.AddMinutes(20));

        var result = await CreateService().ValidateTokenAsync(token);

        Assert.That(result.IsValid, Is.False);
    }

    [Test]
    public async Task ValidateTokenAsync_UnsignedToken_ReturnsInvalid()
    {
        var token = new JwtSecurityToken(
            issuer: ValidIssuer,
            audience: ValidAudience,
            claims: CreateClaims(),
            notBefore: DateTime.UtcNow.AddMinutes(-1),
            expires: DateTime.UtcNow.AddMinutes(10));
        var serialized = new JwtSecurityTokenHandler().WriteToken(token);

        var result = await CreateService().ValidateTokenAsync(serialized);

        Assert.That(result.IsValid, Is.False);
    }

    [TestCase("not-a-guid", true)]
    [TestCase("valid-organizer-id", true)]
    public async Task ValidateTokenAsync_MissingOrMalformedIdentityClaims_ReturnsInvalid(string organizerClaim, bool omitSession)
    {
        var claims = new List<Claim>
        {
            new("organizerId", organizerClaim == "valid-organizer-id" ? Guid.NewGuid().ToString() : organizerClaim),
            new("name", "Admin Test"),
            new("role", "admin")
        };
        if (!omitSession)
        {
            claims.Add(new Claim("sessionId", Guid.NewGuid().ToString()));
        }
        var token = CreateToken(ValidSecret, ValidIssuer, ValidAudience, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(10), customClaims: claims);

        var result = await CreateService().ValidateTokenAsync(token);

        Assert.That(result.IsValid, Is.False);
        Assert.That(result.OrganizerId, Is.Null);
        Assert.That(result.SessionId, Is.Null);
    }

    [Test]
    public async Task ValidateTokenAsync_ValidToken_ReturnsIdentityAndSession()
    {
        var organizerId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var token = CreateToken(ValidSecret, ValidIssuer, ValidAudience, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(10), organizerId, sessionId);

        var result = await CreateService().ValidateTokenAsync(token);

        Assert.That(result.IsValid, Is.True);
        Assert.That(result.OrganizerId, Is.EqualTo(organizerId));
        Assert.That(result.SessionId, Is.EqualTo(sessionId));
        Assert.That(result.Role, Is.EqualTo("admin"));
    }

    private static JwtService CreateService()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["JWT_SECRET_KEY"] = ValidSecret,
            ["JWT_ISSUER"] = ValidIssuer,
            ["JWT_AUDIENCE"] = ValidAudience
        }).Build();
        return new JwtService(configuration, new AdminJwtTestHostEnvironment());
    }

    private static string CreateToken(
        string secret,
        string issuer,
        string audience,
        DateTime notBefore,
        DateTime expires,
        Guid? organizerId = null,
        Guid? sessionId = null,
        IEnumerable<Claim>? customClaims = null)
    {
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer,
            audience,
            customClaims ?? CreateClaims(organizerId, sessionId),
            notBefore,
            expires,
            credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static IEnumerable<Claim> CreateClaims(Guid? organizerId = null, Guid? sessionId = null)
    {
        yield return new Claim("organizerId", (organizerId ?? Guid.NewGuid()).ToString());
        yield return new Claim("name", "Admin Test");
        yield return new Claim("sessionId", (sessionId ?? Guid.NewGuid()).ToString());
        yield return new Claim("role", "admin");
    }
}
