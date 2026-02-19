using Microsoft.AspNetCore.Mvc;

namespace CherryPlayServer.Core.Extensions;

public static class PartyIdExtensions
{
    /// <summary>
    /// Валидирует и парсит partyId из строки в Guid.
    /// Возвращает BadRequest если валидация не прошла.
    /// </summary>
    public static bool TryParsePartyId(string? partyId, out Guid partyGuid, out ActionResult? errorResult)
    {
        partyGuid = Guid.Empty;
        errorResult = null;

        if (string.IsNullOrWhiteSpace(partyId))
        {
            errorResult = new BadRequestObjectResult("Party ID cannot be empty");
            return false;
        }

        if (!Guid.TryParse(partyId, out partyGuid))
        {
            errorResult = new BadRequestObjectResult("Invalid party ID format");
            return false;
        }

        return true;
    }

    /// <summary>
    /// Валидирует partyId и возвращает Guid или null если невалиден.
    /// </summary>
    public static Guid? TryParsePartyId(string? partyId)
    {
        if (string.IsNullOrWhiteSpace(partyId) || !Guid.TryParse(partyId, out var partyGuid))
        {
            return null;
        }
        return partyGuid;
    }
}
