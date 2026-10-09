using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;
using CherryPlayServer.Core.Options;
using Microsoft.Extensions.Options;

namespace CherryPlayServer.Core.Services;

public class DesktopCompatibilityWarningService(IOptions<ClientCompatibilityOptions> options)
    : IDesktopCompatibilityWarningService
{
    public DesktopCompatibilityWarning? GetWarning()
    {
        var compatibility = options.Value;
        var desktop = compatibility.Desktop;

        if (!SemverComparer.TryParse(desktop.NextMinVersion, out var nextMinimum)
            || !SemverComparer.TryParse(desktop.MinVersion, out var currentMinimum)
            || !SemverComparer.TryParse(desktop.NextServerVersion, out var nextServer)
            || !SemverComparer.TryParse(compatibility.ServerVersion, out var currentServer)
            || SemverComparer.CompareMajorMinor(nextMinimum, currentMinimum) <= 0
            || SemverComparer.Compare(nextServer, currentServer) <= 0)
        {
            return null;
        }

        return new DesktopCompatibilityWarning(
            $"{nextMinimum.Major}.{nextMinimum.Minor}.{nextMinimum.Patch}",
            $"{nextServer.Major}.{nextServer.Minor}.{nextServer.Patch}");
    }
}
