using CherryPlayServer.Core.Interfaces;
using CherryPlayServer.Core.Models;

namespace CherryPlayServer.Tests;

internal sealed class RegressionThemeAccessService : IThemeAccessService
{
    public Task<ThemeAccessSummary> GetAccessSummaryAsync(Guid organizerId) =>
        Task.FromResult(new ThemeAccessSummary([], [], string.Empty));

    public Task<ThemeAccessCheckResult> CheckThemeAccessAsync(Guid organizerId, string themeId) =>
        Task.FromResult(new ThemeAccessCheckResult(true, true, []));
}
