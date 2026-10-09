using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IDesktopCompatibilityWarningService
{
    DesktopCompatibilityWarning? GetWarning();
}
