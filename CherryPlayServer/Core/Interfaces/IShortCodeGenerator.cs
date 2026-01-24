namespace CherryPlayServer.Core.Interfaces;

public interface IShortCodeGenerator
{
    Task<string> GenerateUniqueShortCodeAsync(Func<string, Task<bool>> uniquenessChecker, int maxRetries = 10);
}
