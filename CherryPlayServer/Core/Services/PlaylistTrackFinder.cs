using CherryPlayServer.Core.Entities;
using CherryPlayServer.Core.Enums;
using CherryPlayServer.Core.Interfaces;

namespace CherryPlayServer.Core.Services;

/// <summary>
/// Сервис для поиска информации о треках в плейлисте
/// </summary>
public class PlaylistTrackFinder : IPlaylistTrackFinder
{
    /// <summary>
    /// Находит длительность трека по его ID в плейлисте
    /// </summary>
    public double? FindTrackDuration(List<PlayerItem> items, string trackId)
    {
        if (items == null || string.IsNullOrWhiteSpace(trackId))
        {
            return null;
        }

        foreach (var item in items)
        {
            if (item.Type == PlayerItemType.Track && item.Id == trackId)
            {
                return item.Duration.HasValue ? (double)item.Duration.Value : null;
            }

            if (item.Type == PlayerItemType.Group && item.Items != null)
            {
                var duration = FindTrackDuration(item.Items, trackId);
                if (duration.HasValue)
                {
                    return duration;
                }
            }
        }

        return null;
    }
}
