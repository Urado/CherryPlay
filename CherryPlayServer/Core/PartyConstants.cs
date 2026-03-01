namespace CherryPlayServer.Core;

public static class PartyConstants
{
    public const int MaxShortDescriptionLength = 200;

    public const int MaxDanceTagsCount = 20;

    public const int MaxDanceTagLength = 50;

    public static readonly IReadOnlyList<string> PredefinedDanceTags =
    [
        "Кросс-степ вальс",
        "Свободные Вальсы",
        "КД",
        "ШКД",
        "Кадрили",
        "Фигурные вальсы",
    ];
}
