namespace CherryPlayServer.Core;

public static class PartyFutureLimit
{
    public static bool CountsAsFuture(DateTime? eventDateTime, DateTime nowUtc) =>
        !eventDateTime.HasValue || eventDateTime.Value > nowUtc;

    public static bool EntersFutureSet(
        DateTime? previousEventDateTime,
        DateTime? nextEventDateTime,
        DateTime nowUtc) =>
        !CountsAsFuture(previousEventDateTime, nowUtc) && CountsAsFuture(nextEventDateTime, nowUtc);
}
