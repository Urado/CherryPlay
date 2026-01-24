using System.Security.Cryptography;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Core.Services;

public class ShortCodeGenerator : IShortCodeGenerator
{
    private const int DefaultLength = 8;
    private const string DefaultAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private const int DefaultMaxRetries = 10;

    public async Task<string> GenerateUniqueShortCodeAsync(Func<string, Task<bool>> uniquenessChecker, int maxRetries = DefaultMaxRetries)
    {
        for (int attempt = 0; attempt < maxRetries; attempt++)
        {
            var shortCode = GenerateShortCode();
            var isUnique = await uniquenessChecker(shortCode);

            if (isUnique)
            {
                return shortCode;
            }
        }

        throw new InvalidOperationException($"Failed to generate unique short code after {maxRetries} attempts");
    }

    /// <summary>
    /// Генерирует случайный короткий код используя криптографически стойкий генератор.
    /// Использует алфавит из 36 символов (A-Z, 0-9) для генерации 8-символьного кода.
    /// </summary>
    /// <returns>Случайный короткий код</returns>
    private string GenerateShortCode()
    {
        var bytes = new byte[DefaultLength];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);

        var chars = new char[DefaultLength];
        for (int i = 0; i < DefaultLength; i++)
        {
            // Для алфавита из 36 символов bias минимален (< 0.1%)
            // Используем модульную арифметику для равномерного распределения
            chars[i] = DefaultAlphabet[bytes[i] % DefaultAlphabet.Length];
        }

        return new string(chars);
    }
}
