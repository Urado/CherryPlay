using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Tests;

internal sealed class RegressionShortCodeGenerator : IShortCodeGenerator
{
    public Task<string> GenerateUniqueShortCodeAsync(Func<string, Task<bool>> uniquenessChecker, int maxRetries = 10) =>
        Task.FromResult("REGRE01");
}
