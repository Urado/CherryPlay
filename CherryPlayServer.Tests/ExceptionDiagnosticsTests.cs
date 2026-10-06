using CherryPlayServer.Core.Diagnostics;

namespace CherryPlayServer.Tests;

[TestFixture]
public sealed class ExceptionDiagnosticsTests
{
    [Test]
    public void GetFailureLocation_ContainsExceptionTypeAndCallSiteWithoutMessage()
    {
        var exception = CreateSyntheticException();

        var result = ExceptionDiagnostics.GetFailureLocation(exception);

        Assert.That(result, Does.Contain(nameof(CreateSyntheticException)));
        Assert.That(result, Does.Contain(nameof(InvalidOperationException)));
        Assert.That(result, Does.Not.Contain("private diagnostic payload"));
    }

    private static InvalidOperationException CreateSyntheticException()
    {
        try
        {
            throw new InvalidOperationException("private diagnostic payload");
        }
        catch (InvalidOperationException exception)
        {
            return exception;
        }
    }
}
