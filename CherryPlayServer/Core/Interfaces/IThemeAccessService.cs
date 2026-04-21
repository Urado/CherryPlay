using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Core.Interfaces;

public interface IThemeAccessService
{
    Task<ThemeAccessSummary> GetAccessSummaryAsync(Guid organizerId);
    Task<ThemeAccessCheckResult> CheckThemeAccessAsync(Guid organizerId, string themeId);
}
