using System.Net;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class OAuthFailureLogTests
{
    [Test]
    public async Task OAuthStartFailure_LogsSafeDiagnosticsWithoutProviderExceptionData()
    {
        await using var factory = new OAuthFailureLoggingWebApplicationFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/auth/vk/web");

        Assert.That(response.StatusCode, Is.EqualTo(HttpStatusCode.InternalServerError));
        var log = string.Join(Environment.NewLine, factory.LogProvider.Messages);
        Assert.That(log, Does.Contain(nameof(InvalidOperationException)));
        Assert.That(log, Does.Contain("AuthController+<StartWebAuth>d__"));
        Assert.That(log, Does.Not.Contain("private-oauth-token"));
        Assert.That(log, Does.Not.Contain("private@example.test"));
        Assert.That(log, Does.Not.Contain("PARTYSECRET"));
    }
}
