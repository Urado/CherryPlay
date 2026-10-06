using CherryPlayServer.Core.Middleware;
using Microsoft.AspNetCore.Http;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class GlobalExceptionHandlerLoggingTests
{
    [Test]
    public async Task TryHandleAsync_LogsFailureTypeAndLocationWithoutPrivateExceptionMessage()
    {
        var logger = new CapturingGlobalExceptionLogger();
        var handler = new GlobalExceptionHandler(logger);
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var exception = CreateSensitiveException();

        await handler.TryHandleAsync(context, exception, CancellationToken.None);

        Assert.That(logger.Message, Does.Contain(nameof(InvalidOperationException)));
        Assert.That(logger.Message, Does.Contain(nameof(CreateSensitiveException)));
        Assert.That(logger.Message, Does.Not.Contain("oauth-private-token"));
        Assert.That(logger.Message, Does.Not.Contain("private@example.test"));
        Assert.That(logger.Exception, Is.Null);
    }

    private static InvalidOperationException CreateSensitiveException()
    {
        try
        {
            throw new InvalidOperationException("oauth-private-token private@example.test PARTYSECRET");
        }
        catch (InvalidOperationException exception)
        {
            return exception;
        }
    }
}
