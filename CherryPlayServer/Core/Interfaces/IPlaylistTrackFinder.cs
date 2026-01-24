namespace CherryPlayServer.Core.Interfaces;

/// <summary>
/// Интерфейс для поиска информации о треках в плейлисте
/// </summary>
public interface IPlaylistTrackFinder
{
    /// <summary>
    /// Находит длительность трека по его ID в плейлисте
    /// </summary>
    double? FindTrackDuration(List<Core.Entities.PlayerItem> items, string trackId);
}
