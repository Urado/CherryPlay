using CherryPlayServer.Core.Enums;

namespace CherryPlayServer.Models;

public record PartyDto(
    string Id,
    string Name,
    string ShortCode,
    ThemeId ThemeId,
    string CreatedAt,
    bool HasActiveSession,
    string? EventDateTime = null
);
