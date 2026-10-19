namespace CherryPlayServer.Core.Entities;

public sealed record AdminPartyPage(
    IReadOnlyList<AdminPartyListItem> Items,
    int Total,
    int Page,
    int PageSize);
