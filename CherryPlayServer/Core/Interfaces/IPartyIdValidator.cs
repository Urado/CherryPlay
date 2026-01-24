namespace CherryPlayServer.Core.Interfaces;

/// <summary>
/// Интерфейс валидатора для работы с Party ID
/// </summary>
public interface IPartyIdValidator
{
    /// <summary>
    /// Пытается распарсить строку в Guid для Party ID
    /// </summary>
    bool TryParsePartyId(string? partyId, out Guid partyGuid);

    /// <summary>
    /// Валидирует и парсит Party ID, выбрасывает исключение при ошибке
    /// </summary>
    Guid ParsePartyId(string? partyId);
}
