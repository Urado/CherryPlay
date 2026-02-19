namespace CherryPlayServer.Core.Entities;

/// <summary>
/// Сессия организатора. Хранится при выдаче токена; проверка по Id сессии в токене инвалидирует токен при перезапуске сервера или выходе.
/// </summary>
public class OrganizerSession
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
