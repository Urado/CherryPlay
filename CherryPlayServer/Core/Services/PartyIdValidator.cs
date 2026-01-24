using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Core.Services;

/// <summary>
/// Валидатор для работы с Party ID
/// </summary>
public class PartyIdValidator : IPartyIdValidator
{
    /// <summary>
    /// Пытается распарсить строку в Guid для Party ID
    /// </summary>
    public bool TryParsePartyId(string? partyId, out Guid partyGuid)
    {
        partyGuid = Guid.Empty;

        if (string.IsNullOrWhiteSpace(partyId))
        {
            return false;
        }

        return Guid.TryParse(partyId, out partyGuid);
    }

    /// <summary>
    /// Валидирует и парсит Party ID, выбрасывает исключение при ошибке
    /// </summary>
    public Guid ParsePartyId(string? partyId)
    {
        if (!TryParsePartyId(partyId, out var guid))
        {
            throw new ArgumentException($"Invalid party ID format: {partyId}", nameof(partyId));
        }

        return guid;
    }
}
