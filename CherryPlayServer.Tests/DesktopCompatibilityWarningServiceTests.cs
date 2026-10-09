using CherryPlayServer.Core.Options;
using CherryPlayServer.Core.Services;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Tests;

[TestFixture]
public class DesktopCompatibilityWarningServiceTests
{
    [TestCase("0.7.0", "0.8.0", "0.7.0", "0.8.0")]
    [TestCase(" v1.0.3 ", "V0.6.5", "1.0.3", "0.6.5")]
    public void GetWarning_FutureMinimumAndRelease_ReturnsNormalizedVersions(
        string nextMinimum, string nextServer, string expectedMinimum, string expectedServer)
    {
        var service = CreateService(nextMinimum, nextServer);

        var warning = service.GetWarning();

        Assert.That(warning, Is.Not.Null);
        Assert.That(warning!.MinVersion, Is.EqualTo(expectedMinimum));
        Assert.That(warning.ServerVersion, Is.EqualTo(expectedServer));
    }

    [TestCase("", "")]
    [TestCase("0.7.0", "")]
    [TestCase("", "0.8.0")]
    [TestCase("invalid", "0.8.0")]
    [TestCase("0.7.0", "invalid")]
    [TestCase("0.7.0-beta", "0.8.0")]
    [TestCase("0.7.0", "0.6.4")]
    [TestCase("0.7.0", "0.6.3")]
    [TestCase("0.6.9", "0.8.0")]
    [TestCase("0.5.0", "0.8.0")]
    public void GetWarning_InvalidPartialOrObsoleteAnnouncement_ReturnsNull(
        string nextMinimum, string nextServer)
    {
        Assert.That(CreateService(nextMinimum, nextServer).GetWarning(), Is.Null);
    }

    [TestCase("invalid", "0.6.4")]
    [TestCase("0.6.4", "invalid")]
    public void GetWarning_InvalidCurrentPolicy_ReturnsNull(string currentMinimum, string currentServer)
    {
        Assert.That(CreateService("0.7.0", "0.8.0", currentMinimum, currentServer).GetWarning(), Is.Null);
    }

    [Test]
    public void GetWarning_DefaultOptions_ReturnsNull()
    {
        var service = new DesktopCompatibilityWarningService(Options.Create(new ClientCompatibilityOptions()));

        Assert.That(service.GetWarning(), Is.Null);
    }

    [Test]
    public void GetWarning_DefaultMinimumAndFutureMinimumAreEqual_ReturnsNullEvenWithFutureServer()
    {
        var options = new ClientCompatibilityOptions();
        options.Desktop.NextServerVersion = "99.0.0";
        var service = new DesktopCompatibilityWarningService(Options.Create(options));

        Assert.That(options.Desktop.MinVersion, Is.EqualTo("0.7.0"));
        Assert.That(options.Desktop.NextMinVersion, Is.EqualTo("0.7.0"));
        Assert.That(service.GetWarning(), Is.Null);
    }

    private static DesktopCompatibilityWarningService CreateService(
        string nextMinimum, string nextServer,
        string currentMinimum = "0.6.4", string currentServer = "0.6.4")
    {
        return new DesktopCompatibilityWarningService(Options.Create(new ClientCompatibilityOptions
        {
            ServerVersion = currentServer,
            Desktop = new DesktopClientCompatibilityOptions
            {
                MinVersion = currentMinimum,
                NextMinVersion = nextMinimum,
                NextServerVersion = nextServer,
            },
        }));
    }
}
